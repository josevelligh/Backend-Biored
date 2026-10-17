import type { BioRedRepo } from "../data/repo.ts";
import { notFound } from "../lib/errors.ts";
import { buildRedemptionCode } from "../services/qrcode.service.ts";
import { serializeItem, serializeRedemption } from "../serializers/dto.ts";
import { parseOrThrow, redeemSchema } from "../schemas/validation.ts";
import type { RouteContext } from "../routes/router.ts";
import { json } from "../middlewares/errorHandler.ts";

/**
 * Trueque Verde: catálogo de "Hoy en Viveros" y canje de Eco-Puntos.
 */
export function marketplaceController(repo: BioRedRepo) {
  return {
    /** `GET /marketplace/items?category=COMPOST&nodeId=...&affordableFor=user-jose` */
    async listItems(ctx: RouteContext): Promise<Response> {
      const category = ctx.query.get("category")?.toUpperCase();
      const nodeId = ctx.query.get("nodeId");
      const affordableFor = ctx.query.get("affordableFor");

      const [items, nodes] = await Promise.all([repo.listNurseryItems(), repo.listNodes()]);
      const nodeById = new Map(nodes.map((node) => [node.id, node]));

      let userPoints: number | null = null;
      if (affordableFor) {
        const user = await repo.getUser(affordableFor);
        userPoints = user?.ecoPoints ?? 0;
      }

      const filtered = items
        .filter((item) => (category ? item.category === category : true))
        .filter((item) => (nodeId ? item.nodeId === nodeId : true))
        .filter((item) => (affordableFor ? item.pointsCost <= (userPoints ?? 0) : true));

      return json({
        count: filtered.length,
        userPoints,
        items: filtered.map((item) => serializeItem(item, nodeById.get(item.nodeId))),
      });
    },

    /** `GET /marketplace/items/:id` */
    async getItem(ctx: RouteContext): Promise<Response> {
      const item = await repo.getNurseryItem(ctx.params.id);
      if (!item) throw notFound("ITEM_NOT_FOUND", `Insumo ${ctx.params.id} no encontrado.`);

      const node = await repo.getNode(item.nodeId);
      return json({ item: serializeItem(item, node) });
    },

    /** `POST /marketplace/redeem` */
    async redeem(ctx: RouteContext): Promise<Response> {
      const input = parseOrThrow(redeemSchema, await ctx.body(), "POST /marketplace/redeem");

      const item = await repo.getNurseryItem(input.itemId);
      if (!item) throw notFound("ITEM_NOT_FOUND", `Insumo ${input.itemId} no encontrado.`);

      const code = buildRedemptionCode(item.title);
      const result = await repo.redeem(input.userId, input.itemId, code);

      return json(
        {
          message: `¡Canje exitoso! Presenta el recibo ${result.redemption.code} en ${
            (await repo.getNode(result.item.nodeId))?.name ?? "el vivero"
          }.`,
          receipt: serializeRedemption(result.redemption),
          item: serializeItem(result.item),
          wallet: {
            ecoPoints: result.user.ecoPoints,
            pointsSpent: result.redemption.pointsSpent,
          },
        },
        201,
      );
    },

    /** `GET /marketplace/redemptions?userId=...` */
    async redemptions(ctx: RouteContext): Promise<Response> {
      const userId = ctx.query.get("userId");
      if (!userId) throw notFound("USER_NOT_FOUND", "Falta el parámetro userId.");

      const user = await repo.getUser(userId);
      if (!user) throw notFound("USER_NOT_FOUND", `Vecino ${userId} no encontrado.`);

      const redemptions = await repo.listRedemptionsByUser(userId);
      return json({
        count: redemptions.length,
        ecoPoints: user.ecoPoints,
        redemptions: redemptions.map(serializeRedemption),
      });
    },
  };
}
