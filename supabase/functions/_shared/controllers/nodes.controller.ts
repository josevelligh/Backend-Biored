import { BIOMASS_DENSITY_KG_PER_M3 } from "../config/constants.ts";
import type { BioRedRepo } from "../data/repo.ts";
import type { BatchRecord } from "../data/types.ts";
import { notFound } from "../lib/errors.ts";
import { incomingLoadPercent, recommendNode } from "../services/routing.service.ts";
import { computeTripleLayer } from "../services/uct3.service.ts";
import { computeTelemetry } from "../services/telemetry.service.ts";
import {
  serializeBatch,
  serializeBatchResult,
  serializeNode,
  serializeRecommendation,
} from "../serializers/dto.ts";
import { parseOrThrow, processBatchSchema, recommendNodeSchema } from "../schemas/validation.ts";
import type { RouteContext } from "../routes/router.ts";
import { json } from "../middlewares/errorHandler.ts";

/**
 * Controlador de Bio-Nodos: estado de tolvas, enrutamiento inverso
 * (Haversine + load balancing + ahorro de diésel) y motor UCT-3.
 */
export function nodesController(repo: BioRedRepo) {
  return {
    /** `GET /nodes` */
    async list(): Promise<Response> {
      const nodes = await repo.listNodes();
      const summary = {
        total: nodes.length,
        available: nodes.filter((node) => node.status === "available").length,
        busy: nodes.filter((node) => node.status === "busy").length,
        full: nodes.filter((node) => node.status === "full").length,
        avgLoadPercent: nodes.length > 0
          ? Math.round(
            (nodes.reduce((acc, node) => acc + node.currentLoadPercent, 0) / nodes.length) * 10,
          ) / 10
          : 0,
      };

      return json({
        summary,
        nodes: nodes.map((node) => ({
          ...serializeNode(node),
          capacityPercentFree: Math.max(0, 100 - node.currentLoadPercent),
          receivesBiomass: node.status !== "full" && node.currentLoadPercent < 90,
        })),
      });
    },

    /** `GET /nodes/:id` */
    async getOne(ctx: RouteContext): Promise<Response> {
      const node = await repo.getNode(ctx.params.id);
      if (!node) throw notFound("NODE_NOT_FOUND", `Bio-Nodo ${ctx.params.id} no encontrado.`);

      const batches = await repo.listBatches();
      const nodeBatches = batches.filter((batch) => batch.nodeId === node.id).slice(0, 10);

      return json({
        node: serializeNode(node),
        recentBatches: nodeBatches.map(serializeBatch),
        hint: node.bladeHoursUsed >= 40
          ? "Cuchillas Acero 5160 sobre las 40 h: programar afilado o reemplazo."
          : undefined,
      });
    },

    /** `POST /nodes/recommend` — ¿a qué Bio-Nodo le conviene llevar mi poda? */
    async recommend(ctx: RouteContext): Promise<Response> {
      const input = parseOrThrow(recommendNodeSchema, await ctx.body(), "POST /nodes/recommend");
      const nodes = (await repo.listNodes()).filter((node) =>
        input.district ? node.district === input.district : true
      );

      const result = recommendNode(
        nodes,
        { latitude: input.latitude, longitude: input.longitude },
        input.volumeM3,
        input.isMunicipalTruck,
      );

      return json({
        ...serializeRecommendation(result),
        estimatedWeightKg: round(input.volumeM3 * BIOMASS_DENSITY_KG_PER_M3, 2),
      });
    },

    /** `POST /nodes/:id/process-batch` — operario de la máquina UCT-3. */
    async processBatch(ctx: RouteContext): Promise<Response> {
      const input = parseOrThrow(
        processBatchSchema,
        await ctx.body(),
        `POST /nodes/${ctx.params.id}/process-batch`,
      );

      const node = await repo.getNode(ctx.params.id);
      if (!node) throw notFound("NODE_NOT_FOUND", `Bio-Nodo ${ctx.params.id} no encontrado.`);

      const result = computeTripleLayer(input.tonsProcessed, input.moisturePercent);

      const batch: BatchRecord = {
        id: `batch-${crypto.randomUUID()}`,
        nodeId: node.id,
        tonsProcessed: input.tonsProcessed,
        moisturePercent: input.moisturePercent,
        coarseMulchKg: result.coarseMulchKg,
        fineCompostKg: result.fineCompostKg,
        mediumFiberKg: result.mediumFiberKg,
        bioPots: result.bioPots,
        bladeHours: result.bladeHoursUsed,
        compostReadyAt: result.compostReadyAt,
        estimatedValueUsd: result.estimatedValueUsd,
        createdAt: new Date().toISOString(),
      };

      // Procesar el lote libera la tolva: el material ya salió como producto.
      const freedPercent = -(input.tonsProcessed / node.capacityTonDay) * 100;
      const applied = await repo.applyBatch(batch, freedPercent);

      return json(
        {
          message:
            `Lote procesado en ${node.name}. ${result.coarseMulchKg} kg de mulch listos el Día 1.`,
          batch: serializeBatch(applied.batch),
          uct3: serializeBatchResult(result),
          node: serializeNode(applied.node),
          inventory: {
            availableMulchKg: applied.node.availableMulchKg,
            availableCompostKg: applied.node.availableCompostKg,
            availableBioPots: applied.node.availableBioPots,
          },
          hopperAfter: {
            currentLoadPercent: applied.node.currentLoadPercent,
            previousLoadPercent: node.currentLoadPercent,
            incomingLoadPercent: incomingLoadPercent(
              input.tonsProcessed * 1000,
              node.capacityTonDay,
            ),
            status: applied.node.status,
          },
          blade: {
            hoursAdded: result.bladeHoursUsed,
            totalHours: applied.node.bladeHoursUsed,
            alert: applied.node.bladeHoursUsed >= 40,
          },
          notes: result.notes,
        },
        201,
      );
    },

    /** `GET /nodes/:id/batches` */
    async batches(ctx: RouteContext): Promise<Response> {
      const node = await repo.getNode(ctx.params.id);
      if (!node) throw notFound("NODE_NOT_FOUND", `Bio-Nodo ${ctx.params.id} no encontrado.`);

      const batches = (await repo.listBatches()).filter((batch) => batch.nodeId === node.id);
      const totals = batches.reduce(
        (acc, batch) => ({
          tonsProcessed: round(acc.tonsProcessed + batch.tonsProcessed, 2),
          mulchKg: round(acc.mulchKg + batch.coarseMulchKg, 2),
          compostKg: round(acc.compostKg + batch.fineCompostKg, 2),
          bioPots: acc.bioPots + batch.bioPots,
          estimatedValueUsd: round(acc.estimatedValueUsd + batch.estimatedValueUsd, 2),
        }),
        { tonsProcessed: 0, mulchKg: 0, compostKg: 0, bioPots: 0, estimatedValueUsd: 0 },
      );

      return json({ node: serializeNode(node), totals, batches: batches.map(serializeBatch) });
    },

    /** `GET /nodes/impact/network` — foto rápida de la red para el pitch. */
    async networkImpact(): Promise<Response> {
      const [nodes, batches, users, tickets] = await Promise.all([
        repo.listNodes(),
        repo.listBatches(),
        repo.listUsers(),
        repo.listTickets(),
      ]);

      return json({
        telemetry: computeTelemetry({ nodes, batches, users, tickets }),
        nodes: nodes.map(serializeNode),
      });
    },
  };
}

const round = (value: number, decimals = 2): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};
