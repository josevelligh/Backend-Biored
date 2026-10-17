import { SIZE_CATEGORIES } from "../config/constants.ts";
import type { BioRedRepo } from "../data/repo.ts";
import type { PruningTicketRecord } from "../data/types.ts";
import { conflict, notFound, unprocessable } from "../lib/errors.ts";
import { createQrToken, normalizeScannedValue } from "../services/qrcode.service.ts";
import {
  estimatedWeightKg,
  incomingLoadPercent,
  recommendNode,
} from "../services/routing.service.ts";
import { serializeNode, serializeTicket } from "../serializers/dto.ts";
import { createTicketSchema, parseOrThrow, verifyQrSchema } from "../schemas/validation.ts";
import type { RouteContext } from "../routes/router.ts";
import { json } from "../middlewares/errorHandler.ts";

/**
 * Controlador del programa "Rama por Planta":
 * registro de poda del vecino (vale QR) y liquidación por parte del operario.
 */
export function pruningController(repo: BioRedRepo) {
  return {
    /** `POST /pruning/tickets` */
    async createTicket(ctx: RouteContext): Promise<Response> {
      const input = parseOrThrow(
        createTicketSchema,
        await ctx.body(),
        "POST /pruning/tickets",
      );

      const user = await repo.getUser(input.userId);
      if (!user) throw notFound("USER_NOT_FOUND", `Vecino ${input.userId} no encontrado.`);

      const { volumeM3, points } = SIZE_CATEGORIES[input.sizeCategory];
      const nodes = await repo.listNodes();

      let node = null;
      let assignmentReason = "";

      if (input.assignedNodeId) {
        node = nodes.find((candidate) => candidate.id === input.assignedNodeId) ?? null;
        if (!node) {
          throw notFound("NODE_NOT_FOUND", `Bio-Nodo ${input.assignedNodeId} no encontrado.`);
        }
        assignmentReason = "Nodo elegido por el vecino en el mapa.";
      } else if (input.latitude !== undefined && input.longitude !== undefined) {
        const recommendation = recommendNode(
          nodes,
          { latitude: input.latitude, longitude: input.longitude },
          volumeM3,
          false,
        );
        node = recommendation.recommended
          ? nodes.find((n) => n.id === recommendation.recommended!.node.id) ?? null
          : null;
        assignmentReason = recommendation.recommended
          ? `Nodo óptimo a ${recommendation.recommended.distanceKm} km, con $${recommendation.recommended.fuelSavedUsd} de ahorro en diésel.`
          : "Ningún Bio-Nodo con capacidad disponible ahora mismo.";
      } else {
        // Sin GPS: se elige el nodo menos cargado (mejor reparto de la red).
        node = [...nodes].sort((a, b) => a.currentLoadPercent - b.currentLoadPercent)[0] ?? null;
        assignmentReason = "Sin ubicación: se asignó el Bio-Nodo con más capacidad hoy.";
      }

      if (!node) throw unprocessable("NO_NODE_AVAILABLE", "No hay Bio-Nodos registrados todavía.");

      const token = await createQrToken(node.name, input.sizeCategory);
      const weightKg = estimatedWeightKg(volumeM3);

      const ticket: PruningTicketRecord = {
        id: `ticket-${crypto.randomUUID()}`,
        code: token.code,
        qrCodeHash: token.qrCodeHash,
        qrPayload: token.qrPayload,
        userId: user.id,
        assignedNodeId: node.id,
        sizeCategory: input.sizeCategory,
        estimatedVolumeM3: volumeM3,
        estimatedWeightKg: weightKg,
        pointsAwarded: points,
        photoUrl: input.photoUrl ?? null,
        status: "PENDING",
        createdAt: new Date().toISOString(),
        verifiedAt: null,
        verifiedBy: null,
      };

      const created = await repo.createTicket(ticket);

      return json(
        {
          ticket: serializeTicket(created, node),
          assignment: {
            nodeId: node.id,
            nodeName: node.name,
            address: node.address,
            district: node.district,
            reason: assignmentReason,
            incomingLoadPercent: incomingLoadPercent(weightKg, node.capacityTonDay),
          },
          instructions:
            "Presenta este código QR en el Bio-Nodo. El operario lo escaneará para acreditar tus Eco-Puntos.",
        },
        201,
      );
    },

    /** `GET /pruning/tickets?userId=...&status=...` */
    async listTickets(ctx: RouteContext): Promise<Response> {
      const userId = ctx.query.get("userId");
      const status = ctx.query.get("status");

      const tickets = userId ? await repo.listTicketsByUser(userId) : await repo.listTickets();
      const filtered = status ? tickets.filter((ticket) => ticket.status === status) : tickets;

      const nodes = await repo.listNodes();
      const byId = new Map(nodes.map((node) => [node.id, node]));

      return json({
        count: filtered.length,
        tickets: filtered.map((ticket) => serializeTicket(ticket, byId.get(ticket.assignedNodeId))),
      });
    },

    /** `POST /pruning/verify-qr` — operario del Bio-Nodo. */
    async verifyQr(ctx: RouteContext): Promise<Response> {
      const input = parseOrThrow(verifyQrSchema, await ctx.body(), "POST /pruning/verify-qr");
      const lookup = sanitizeLookup(normalizeScannedValue(input.qrCodeHash));

      const ticket = await repo.findTicket(lookup);
      if (!ticket) {
        throw notFound(
          "TICKET_NOT_FOUND",
          "El vale QR no existe. Verifica el código e intenta de nuevo.",
        );
      }
      if (ticket.status === "VERIFIED") {
        throw conflict("TICKET_ALREADY_VERIFIED", "Este vale ya fue liquidado anteriormente.");
      }

      const node = await repo.getNode(ticket.assignedNodeId);
      if (!node) throw notFound("NODE_NOT_FOUND", "El Bio-Nodo asignado ya no existe.");

      const loadDeltaPercent = incomingLoadPercent(ticket.estimatedWeightKg, node.capacityTonDay);
      const result = await repo.verifyTicket(lookup, input.operatorId, loadDeltaPercent);

      return json({
        message:
          `Vale verificado. ${result.ticket.pointsAwarded} Eco-Puntos acreditados a ${result.user.name}.`,
        ticket: serializeTicket(result.ticket, result.node),
        user: {
          id: result.user.id,
          name: result.user.name,
          ecoPoints: result.user.ecoPoints,
          totalKgDelivered: result.user.totalKgDelivered,
        },
        node: serializeNode(result.node),
        hopperStatus: {
          currentLoadPercent: result.node.currentLoadPercent,
          status: result.node.status,
          incomingLoadPercent: loadDeltaPercent,
        },
      });
    },
  };
}

/** Evita inyección de operadores en el filtro PostgREST (`.or(...)`). */
export function sanitizeLookup(value: string): string {
  const cleaned = value.trim();
  if (!/^[A-Za-z0-9_:.-]{4,160}$/.test(cleaned)) {
    throw unprocessable(
      "INVALID_QR_CODE",
      "El código QR tiene un formato inválido. Vuelve a escanear el vale.",
    );
  }
  return cleaned;
}
