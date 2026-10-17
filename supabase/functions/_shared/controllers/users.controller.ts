import { UCT3 } from "../config/constants.ts";
import type { BioRedRepo } from "../data/repo.ts";
import { notFound } from "../lib/errors.ts";
import { serializeRedemption, serializeTicket, serializeUser } from "../serializers/dto.ts";
import type { RouteContext } from "../routes/router.ts";
import { json } from "../middlewares/errorHandler.ts";

/**
 * Perfil del vecino: billetera de Eco-Puntos, vales QR e impacto personal.
 * Alimenta las pantallas "Impacto" y "Perfil" de la app Expo.
 */
export function usersController(repo: BioRedRepo) {
  return {
    /** `GET /users?role=CITIZEN` */
    async list(ctx: RouteContext): Promise<Response> {
      const role = ctx.query.get("role")?.toUpperCase();
      const users = await repo.listUsers();
      const filtered = role ? users.filter((user) => user.role === role) : users;
      return json({ count: filtered.length, users: filtered.map(serializeUser) });
    },

    /** `GET /users/:id` — perfil + impacto + billetera. */
    async getOne(ctx: RouteContext): Promise<Response> {
      const user = await repo.getUser(ctx.params.id);
      if (!user) throw notFound("USER_NOT_FOUND", `Vecino ${ctx.params.id} no encontrado.`);

      const [tickets, redemptions, nodes] = await Promise.all([
        repo.listTicketsByUser(user.id),
        repo.listRedemptionsByUser(user.id),
        repo.listNodes(),
      ]);

      const nodeById = new Map(nodes.map((node) => [node.id, node]));
      const pending = tickets.filter((ticket) => ticket.status === "PENDING");
      const verified = tickets.filter((ticket) => ticket.status === "VERIFIED");
      const co2SavedKg = round(user.totalKgDelivered * 0.715, 2);

      return json({
        user: serializeUser(user),
        impact: {
          totalKgDelivered: user.totalKgDelivered,
          co2SavedKg,
          waterSavedPercentage: UCT3.mulchWaterSavingsPercent,
          temperatureReductionC: UCT3.mulchTempReductionC,
          compostDaysCycle: UCT3.compostCycleDays,
          mulchCoverageM2Equivalent: round(
            (user.totalKgDelivered / 1000) * UCT3.mulchCoverageM2PerTon,
            1,
          ),
        },
        wallet: {
          ecoPoints: user.ecoPoints,
          pointsFromPending: pending.reduce((acc, ticket) => acc + ticket.pointsAwarded, 0),
          activeVouchersCount: pending.length,
          verifiedVouchersCount: verified.length,
          redemptionsCount: redemptions.length,
        },
        tickets: tickets.map((ticket) =>
          serializeTicket(ticket, nodeById.get(ticket.assignedNodeId))
        ),
        redemptions: redemptions.map(serializeRedemption),
      });
    },

    /** `POST /users/:id/points` — ajuste administrativo (demo del panel municipal). */
    async wallet(ctx: RouteContext): Promise<Response> {
      const user = await repo.getUser(ctx.params.id);
      if (!user) throw notFound("USER_NOT_FOUND", `Vecino ${ctx.params.id} no encontrado.`);

      const [tickets, redemptions] = await Promise.all([
        repo.listTicketsByUser(user.id),
        repo.listRedemptionsByUser(user.id),
      ]);

      return json({
        user: serializeUser(user),
        tickets: tickets.map((ticket) => serializeTicket(ticket)),
        redemptions: redemptions.map(serializeRedemption),
      });
    },
  };
}

const round = (value: number, decimals = 2): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};
