import { conflict, notFound } from "../lib/errors.ts";
import { nodeStatusFromLoad } from "../services/routing.service.ts";
import type { ApplyBatchResult, BioRedRepo, RedeemResult, VerifyTicketResult } from "./repo.ts";
import {
  SEED_BATCHES,
  SEED_NODES,
  SEED_NURSERY_ITEMS,
  SEED_POSTS,
  SEED_REDEMPTIONS,
  SEED_TICKETS,
  SEED_USERS,
} from "./seed.ts";
import type {
  BatchRecord,
  BioNodeRecord,
  CommunityPostRecord,
  NurseryItemRecord,
  PruningTicketRecord,
  RedemptionRecord,
  UserRecord,
} from "./types.ts";

const clone = <T>(value: T): T => structuredClone(value);

/**
 * Adaptador en memoria: mismas reglas de negocio que Postgres, sin base de datos.
 * Se usa cuando no hay credenciales de Supabase, para demos locales instantáneas.
 *
 * Las operaciones "atómicas" se serializan con una cola de promesas, replicando
 * el comportamiento de las transacciones de Postgres.
 */
export class MemoryRepo implements BioRedRepo {
  readonly mode = "memory" as const;

  private nodes: BioNodeRecord[] = clone(SEED_NODES);
  private users: UserRecord[] = clone(SEED_USERS);
  private tickets: PruningTicketRecord[] = clone(SEED_TICKETS);
  private items: NurseryItemRecord[] = clone(SEED_NURSERY_ITEMS);
  private posts: CommunityPostRecord[] = clone(SEED_POSTS);
  private redemptions: RedemptionRecord[] = clone(SEED_REDEMPTIONS);
  private batches: BatchRecord[] = clone(SEED_BATCHES);

  /** Cola de exclusión mutua para operaciones transaccionales. */
  private lock: Promise<unknown> = Promise.resolve();

  private serialize<T>(operation: () => T): Promise<T> {
    const result = this.lock.then(operation);
    this.lock = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  listNodes(): Promise<BioNodeRecord[]> {
    return Promise.resolve(clone(this.nodes));
  }

  getNode(id: string): Promise<BioNodeRecord | null> {
    const found = this.nodes.find((node) => node.id === id);
    return Promise.resolve(found ? clone(found) : null);
  }

  listUsers(): Promise<UserRecord[]> {
    return Promise.resolve(clone(this.users));
  }

  getUser(id: string): Promise<UserRecord | null> {
    const found = this.users.find((user) => user.id === id);
    return Promise.resolve(found ? clone(found) : null);
  }

  createTicket(ticket: PruningTicketRecord): Promise<PruningTicketRecord> {
    return this.serialize(() => {
      this.tickets.unshift(clone(ticket));
      return clone(ticket);
    });
  }

  findTicket(lookup: string): Promise<PruningTicketRecord | null> {
    const match = this.tickets.find((ticket) =>
      ticket.qrCodeHash === lookup || ticket.code === lookup || ticket.qrPayload === lookup
    );
    return Promise.resolve(match ? clone(match) : null);
  }

  listTicketsByUser(userId: string): Promise<PruningTicketRecord[]> {
    const list = this.tickets
      .filter((ticket) => ticket.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return Promise.resolve(clone(list));
  }

  listTickets(): Promise<PruningTicketRecord[]> {
    const list = [...this.tickets].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return Promise.resolve(clone(list));
  }

  verifyTicket(
    lookup: string,
    operatorId: string,
    loadDeltaPercent: number,
  ): Promise<VerifyTicketResult> {
    return this.serialize(() => {
      const ticket = this.tickets.find((t) =>
        t.qrCodeHash === lookup || t.code === lookup || t.qrPayload === lookup
      );
      if (!ticket) throw notFound("TICKET_NOT_FOUND", "El vale QR no existe o ya expiró.");
      if (ticket.status === "VERIFIED") {
        throw conflict("TICKET_ALREADY_VERIFIED", "Este vale ya fue liquidado en un Bio-Nodo.");
      }
      if (ticket.status === "CANCELLED") {
        throw conflict("TICKET_CANCELLED", "Este vale fue cancelado por el vecino.");
      }

      const operator = this.users.find((user) => user.id === operatorId);
      if (!operator) throw notFound("OPERATOR_NOT_FOUND", `Operario ${operatorId} no encontrado.`);

      const node = this.nodes.find((n) => n.id === ticket.assignedNodeId);
      if (!node) throw notFound("NODE_NOT_FOUND", "El Bio-Nodo asignado ya no existe.");

      const user = this.users.find((u) => u.id === ticket.userId);
      if (!user) throw notFound("USER_NOT_FOUND", "El vecino titular del vale no existe.");

      const verifiedAt = new Date().toISOString();
      ticket.status = "VERIFIED";
      ticket.verifiedAt = verifiedAt;
      ticket.verifiedBy = operatorId;

      const load = clampPercent(node.currentLoadPercent + loadDeltaPercent);
      node.currentLoadPercent = load;
      node.status = nodeStatusFromLoad(load);
      node.updatedAt = verifiedAt;

      user.ecoPoints += ticket.pointsAwarded;
      user.totalKgDelivered = round(user.totalKgDelivered + ticket.estimatedWeightKg, 2);

      return { ticket: clone(ticket), user: clone(user), node: clone(node) };
    });
  }

  listNurseryItems(): Promise<NurseryItemRecord[]> {
    return Promise.resolve(clone(this.items));
  }

  getNurseryItem(id: string): Promise<NurseryItemRecord | null> {
    const found = this.items.find((item) => item.id === id);
    return Promise.resolve(found ? clone(found) : null);
  }

  redeem(userId: string, itemId: string, redemptionCode: string): Promise<RedeemResult> {
    return this.serialize(() => {
      const user = this.users.find((u) => u.id === userId);
      if (!user) throw notFound("USER_NOT_FOUND", `Vecino ${userId} no encontrado.`);

      const item = this.items.find((i) => i.id === itemId);
      if (!item) throw notFound("ITEM_NOT_FOUND", `Insumo ${itemId} no encontrado en el vivero.`);
      if (item.stock <= 0) {
        throw conflict("OUT_OF_STOCK", `${item.title} está agotado en este vivero.`);
      }
      if (user.ecoPoints < item.pointsCost) {
        throw conflict(
          "INSUFFICIENT_POINTS",
          `Te faltan ${item.pointsCost - user.ecoPoints} Eco-Puntos para canjear ${item.title}.`,
        );
      }

      user.ecoPoints -= item.pointsCost;
      item.stock -= 1;

      const redemption: RedemptionRecord = {
        id: `redemption-${crypto.randomUUID()}`,
        userId,
        itemId,
        itemTitle: item.title,
        pointsSpent: item.pointsCost,
        code: redemptionCode,
        createdAt: new Date().toISOString(),
      };
      this.redemptions.unshift(redemption);

      return { user: clone(user), item: clone(item), redemption: clone(redemption) };
    });
  }

  listRedemptionsByUser(userId: string): Promise<RedemptionRecord[]> {
    const list = this.redemptions
      .filter((redemption) => redemption.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return Promise.resolve(clone(list));
  }

  listPosts(): Promise<CommunityPostRecord[]> {
    const list = [...this.posts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return Promise.resolve(clone(list));
  }

  createPost(post: CommunityPostRecord): Promise<CommunityPostRecord> {
    return this.serialize(() => {
      this.posts.unshift(clone(post));
      return clone(post);
    });
  }

  likePost(id: string, delta: number): Promise<CommunityPostRecord | null> {
    return this.serialize(() => {
      const post = this.posts.find((p) => p.id === id);
      if (!post) return null;
      post.likesCount = Math.max(0, post.likesCount + delta);
      return clone(post);
    });
  }

  applyBatch(batch: BatchRecord, loadDeltaPercent: number): Promise<ApplyBatchResult> {
    return this.serialize(() => {
      const node = this.nodes.find((n) => n.id === batch.nodeId);
      if (!node) throw notFound("NODE_NOT_FOUND", `Bio-Nodo ${batch.nodeId} no encontrado.`);

      this.batches.unshift(clone(batch));

      node.availableMulchKg = round(node.availableMulchKg + batch.coarseMulchKg, 2);
      node.availableCompostKg = round(node.availableCompostKg + batch.fineCompostKg, 2);
      node.availableBioPots += batch.bioPots;
      node.bladeHoursUsed = round(node.bladeHoursUsed + batch.bladeHours, 2);

      const load = clampPercent(node.currentLoadPercent + loadDeltaPercent);
      node.currentLoadPercent = load;
      node.status = nodeStatusFromLoad(load);
      node.updatedAt = new Date().toISOString();

      return { batch: clone(batch), node: clone(node) };
    });
  }

  listBatches(): Promise<BatchRecord[]> {
    const list = [...this.batches].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return Promise.resolve(clone(list));
  }
}

const round = (value: number, decimals = 2): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

/** La ocupación de la tolva siempre vive en el rango [0, 100]. */
const clampPercent = (value: number): number => round(Math.min(100, Math.max(0, value)), 2);
