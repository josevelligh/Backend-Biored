import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { AppError, type DomainErrorCode } from "../lib/errors.ts";
import type { ApplyBatchResult, BioRedRepo, RedeemResult, VerifyTicketResult } from "./repo.ts";
import type {
  BatchRecord,
  BioNodeRecord,
  CommunityPostRecord,
  NurseryItemRecord,
  PruningTicketRecord,
  RedemptionRecord,
  UserRecord,
} from "./types.ts";

/**
 * Adaptador de producción: Supabase Postgres.
 *
 * Las operaciones que tocan varias tablas (liquidar un QR, canjear, procesar un
 * lote) se ejecutan en funciones RPC de Postgres para garantizar atomicidad.
 * El resto son consultas simples vía PostgREST.
 */
export class PostgresRepo implements BioRedRepo {
  readonly mode = "postgres" as const;
  private readonly db: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.db = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { "x-application-name": "biored-api" } },
    });
  }

  private async rows<T>(
    query: PromiseLike<{ data: unknown; error: { message: string } | null }>,
  ): Promise<T[]> {
    const { data, error } = await query;
    if (error) throw new AppError(500, "DB_ERROR", error.message);
    return (data ?? []) as T[];
  }

  private async maybeRow<T>(
    query: PromiseLike<{ data: unknown; error: { message: string } | null }>,
  ): Promise<T | null> {
    const { data, error } = await query;
    if (error) throw new AppError(500, "DB_ERROR", error.message);
    return (data as T | null) ?? null;
  }

  /** Traduce los `RAISE EXCEPTION 'BIORED:CODE:detalle'` de Postgres a AppError. */
  private rpcError(message: string): never {
    const marker = /BIORED:([A-Z_]+):?(.*)/.exec(message);
    if (marker) {
      const code = marker[1] as DomainErrorCode;
      const detail = (marker[2] || "").trim() || code;
      const statusByCode: Partial<Record<DomainErrorCode, number>> = {
        TICKET_NOT_FOUND: 404,
        NODE_NOT_FOUND: 404,
        USER_NOT_FOUND: 404,
        ITEM_NOT_FOUND: 404,
        OPERATOR_NOT_FOUND: 404,
        TICKET_ALREADY_VERIFIED: 409,
        TICKET_CANCELLED: 409,
        OUT_OF_STOCK: 409,
        INSUFFICIENT_POINTS: 409,
      };
      const status = statusByCode[code] ?? 400;
      throw new AppError(status, code, detail);
    }
    throw new AppError(500, "DB_ERROR", message);
  }

  async listNodes(): Promise<BioNodeRecord[]> {
    const rows = await this.rows<DbNode>(
      this.db.from("bio_nodes").select("*").order("name", { ascending: true }),
    );
    return rows.map(mapNode);
  }

  async getNode(id: string): Promise<BioNodeRecord | null> {
    const row = await this.maybeRow<DbNode>(
      this.db.from("bio_nodes").select("*").eq("id", id).maybeSingle(),
    );
    return row ? mapNode(row) : null;
  }

  async listUsers(): Promise<UserRecord[]> {
    const rows = await this.rows<DbUser>(this.db.from("users").select("*"));
    return rows.map(mapUser);
  }

  async getUser(id: string): Promise<UserRecord | null> {
    const row = await this.maybeRow<DbUser>(
      this.db.from("users").select("*").eq("id", id).maybeSingle(),
    );
    return row ? mapUser(row) : null;
  }

  async createTicket(ticket: PruningTicketRecord): Promise<PruningTicketRecord> {
    const { data, error } = await this.db
      .from("pruning_tickets")
      .insert(toDbTicket(ticket))
      .select("*")
      .single();
    if (error) throw new AppError(500, "DB_ERROR", error.message);
    return mapTicket(data as DbTicket);
  }

  async findTicket(lookup: string): Promise<PruningTicketRecord | null> {
    const row = await this.maybeRow<DbTicket>(
      this.db
        .from("pruning_tickets")
        .select("*")
        .or(`qr_code_hash.eq.${lookup},code.eq.${lookup},qr_payload.eq.${lookup}`)
        .maybeSingle(),
    );
    return row ? mapTicket(row) : null;
  }

  async listTicketsByUser(userId: string): Promise<PruningTicketRecord[]> {
    const rows = await this.rows<DbTicket>(
      this.db
        .from("pruning_tickets")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
    );
    return rows.map(mapTicket);
  }

  async listTickets(): Promise<PruningTicketRecord[]> {
    const rows = await this.rows<DbTicket>(
      this.db.from("pruning_tickets").select("*").order("created_at", { ascending: false }),
    );
    return rows.map(mapTicket);
  }

  async verifyTicket(
    lookup: string,
    operatorId: string,
    loadDeltaPercent: number,
  ): Promise<VerifyTicketResult> {
    const { data, error } = await this.db.rpc("biored_verify_ticket", {
      p_lookup: lookup,
      p_operator_id: operatorId,
      p_load_delta_percent: loadDeltaPercent,
    });
    if (error) this.rpcError(error.message);

    const payload = data as { ticket: DbTicket; user: DbUser; node: DbNode };
    return {
      ticket: mapTicket(payload.ticket),
      user: mapUser(payload.user),
      node: mapNode(payload.node),
    };
  }

  async listNurseryItems(): Promise<NurseryItemRecord[]> {
    const rows = await this.rows<DbItem>(
      this.db.from("nursery_items").select("*").order("points_cost", { ascending: true }),
    );
    return rows.map(mapItem);
  }

  async getNurseryItem(id: string): Promise<NurseryItemRecord | null> {
    const row = await this.maybeRow<DbItem>(
      this.db.from("nursery_items").select("*").eq("id", id).maybeSingle(),
    );
    return row ? mapItem(row) : null;
  }

  async redeem(userId: string, itemId: string, redemptionCode: string): Promise<RedeemResult> {
    const { data, error } = await this.db.rpc("biored_redeem_item", {
      p_user_id: userId,
      p_item_id: itemId,
      p_code: redemptionCode,
    });
    if (error) this.rpcError(error.message);

    const payload = data as { user: DbUser; item: DbItem; redemption: DbRedemption };
    return {
      user: mapUser(payload.user),
      item: mapItem(payload.item),
      redemption: mapRedemption(payload.redemption),
    };
  }

  async listRedemptionsByUser(userId: string): Promise<RedemptionRecord[]> {
    const rows = await this.rows<DbRedemption>(
      this.db
        .from("redemptions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
    );
    return rows.map(mapRedemption);
  }

  async listPosts(): Promise<CommunityPostRecord[]> {
    const rows = await this.rows<DbPost>(
      this.db.from("community_posts").select("*").order("created_at", { ascending: false }),
    );
    return rows.map(mapPost);
  }

  async createPost(post: CommunityPostRecord): Promise<CommunityPostRecord> {
    const { data, error } = await this.db
      .from("community_posts")
      .insert(toDbPost(post))
      .select("*")
      .single();
    if (error) throw new AppError(500, "DB_ERROR", error.message);
    return mapPost(data as DbPost);
  }

  async likePost(id: string, delta: number): Promise<CommunityPostRecord | null> {
    const post = await this.maybeRow<DbPost>(
      this.db.from("community_posts").select("*").eq("id", id).maybeSingle(),
    );
    if (!post) return null;

    const nextLikes = Math.max(0, post.likes_count + delta);
    const row = await this.maybeRow<DbPost>(
      this.db
        .from("community_posts")
        .update({ likes_count: nextLikes })
        .eq("id", id)
        .select("*")
        .maybeSingle(),
    );
    return row ? mapPost(row) : null;
  }

  async applyBatch(batch: BatchRecord, loadDeltaPercent: number): Promise<ApplyBatchResult> {
    const { data, error } = await this.db.rpc("biored_apply_batch", {
      p_id: batch.id,
      p_node_id: batch.nodeId,
      p_tons_processed: batch.tonsProcessed,
      p_moisture_percent: batch.moisturePercent,
      p_coarse_mulch_kg: batch.coarseMulchKg,
      p_fine_compost_kg: batch.fineCompostKg,
      p_medium_fiber_kg: batch.mediumFiberKg,
      p_bio_pots: batch.bioPots,
      p_blade_hours: batch.bladeHours,
      p_compost_ready_at: batch.compostReadyAt,
      p_estimated_value_usd: batch.estimatedValueUsd,
      p_load_delta_percent: loadDeltaPercent,
    });
    if (error) this.rpcError(error.message);

    const payload = data as { batch: DbBatch; node: DbNode };
    return { batch: mapBatch(payload.batch), node: mapNode(payload.node) };
  }

  async listBatches(): Promise<BatchRecord[]> {
    const rows = await this.rows<DbBatch>(
      this.db.from("bio_batches").select("*").order("created_at", { ascending: false }),
    );
    return rows.map(mapBatch);
  }
}

// ---------------------------------------------------------------------------
// Filas de Postgres (snake_case) y mapeo a dominio (camelCase)
// ---------------------------------------------------------------------------

interface DbUser {
  id: string;
  name: string;
  role: UserRecord["role"];
  district: string;
  avatar_url: string | null;
  eco_points: number;
  total_kg_delivered: number;
  created_at: string;
}

interface DbNode {
  id: string;
  name: string;
  district: string;
  address: string;
  latitude: number;
  longitude: number;
  capacity_ton_day: number;
  current_load_percent: number;
  status: BioNodeRecord["status"];
  available_mulch_kg: number;
  available_compost_kg: number;
  available_bio_pots: number;
  blade_hours_used: number;
  coordinator: string | null;
  phone: string | null;
  operating_hours: string | null;
  updated_at: string;
}

interface DbTicket {
  id: string;
  code: string;
  qr_code_hash: string;
  qr_payload: string;
  user_id: string;
  assigned_node_id: string;
  size_category: PruningTicketRecord["sizeCategory"];
  estimated_volume_m3: number;
  estimated_weight_kg: number;
  points_awarded: number;
  photo_url: string | null;
  status: PruningTicketRecord["status"];
  created_at: string;
  verified_at: string | null;
  verified_by: string | null;
}

interface DbItem {
  id: string;
  node_id: string;
  provider_name: string;
  provider_avatar: string | null;
  title: string;
  description: string;
  category: NurseryItemRecord["category"];
  points_cost: number;
  branches_kg_required: number;
  stock: number;
  image_url: string | null;
}

interface DbPost {
  id: string;
  user_id: string;
  node_id: string | null;
  author_name: string;
  author_role: string;
  author_avatar: string | null;
  location: string;
  content: string;
  image_url: string | null;
  kg_contributed: number;
  likes_count: number;
  comments_count: number;
  is_challenge: boolean;
  challenge_goal_kg: number | null;
  current_kg: number | null;
  end_date: string | null;
  participants_count: number | null;
  tag: string | null;
  verified_badge: boolean;
  created_at: string;
}

interface DbRedemption {
  id: string;
  user_id: string;
  item_id: string;
  item_title: string;
  points_spent: number;
  code: string;
  created_at: string;
}

interface DbBatch {
  id: string;
  node_id: string;
  tons_processed: number;
  moisture_percent: number;
  coarse_mulch_kg: number;
  fine_compost_kg: number;
  medium_fiber_kg: number;
  bio_pots: number;
  blade_hours: number;
  compost_ready_at: string;
  estimated_value_usd: number;
  created_at: string;
}

const mapUser = (row: DbUser): UserRecord => ({
  id: row.id,
  name: row.name,
  role: row.role,
  district: row.district,
  avatarUrl: row.avatar_url,
  ecoPoints: row.eco_points,
  totalKgDelivered: row.total_kg_delivered,
  createdAt: row.created_at,
});

const mapNode = (row: DbNode): BioNodeRecord => ({
  id: row.id,
  name: row.name,
  district: row.district,
  address: row.address,
  latitude: row.latitude,
  longitude: row.longitude,
  capacityTonDay: row.capacity_ton_day,
  currentLoadPercent: row.current_load_percent,
  status: row.status,
  availableMulchKg: row.available_mulch_kg,
  availableCompostKg: row.available_compost_kg,
  availableBioPots: row.available_bio_pots,
  bladeHoursUsed: row.blade_hours_used,
  coordinator: row.coordinator,
  phone: row.phone,
  operatingHours: row.operating_hours,
  updatedAt: row.updated_at,
});

const mapTicket = (row: DbTicket): PruningTicketRecord => ({
  id: row.id,
  code: row.code,
  qrCodeHash: row.qr_code_hash,
  qrPayload: row.qr_payload,
  userId: row.user_id,
  assignedNodeId: row.assigned_node_id,
  sizeCategory: row.size_category,
  estimatedVolumeM3: row.estimated_volume_m3,
  estimatedWeightKg: row.estimated_weight_kg,
  pointsAwarded: row.points_awarded,
  photoUrl: row.photo_url,
  status: row.status,
  createdAt: row.created_at,
  verifiedAt: row.verified_at,
  verifiedBy: row.verified_by,
});

const mapItem = (row: DbItem): NurseryItemRecord => ({
  id: row.id,
  nodeId: row.node_id,
  providerName: row.provider_name,
  providerAvatar: row.provider_avatar,
  title: row.title,
  description: row.description,
  category: row.category,
  pointsCost: row.points_cost,
  branchesKgRequired: row.branches_kg_required,
  stock: row.stock,
  imageUrl: row.image_url,
});

const mapPost = (row: DbPost): CommunityPostRecord => ({
  id: row.id,
  userId: row.user_id,
  nodeId: row.node_id,
  authorName: row.author_name,
  authorRole: row.author_role,
  authorAvatar: row.author_avatar,
  location: row.location,
  content: row.content,
  imageUrl: row.image_url,
  kgContributed: row.kg_contributed,
  likesCount: row.likes_count,
  commentsCount: row.comments_count,
  isChallenge: row.is_challenge,
  challengeGoalKg: row.challenge_goal_kg,
  currentKg: row.current_kg,
  endDate: row.end_date,
  participantsCount: row.participants_count,
  tag: row.tag,
  verifiedBadge: row.verified_badge,
  createdAt: row.created_at,
});

const mapRedemption = (row: DbRedemption): RedemptionRecord => ({
  id: row.id,
  userId: row.user_id,
  itemId: row.item_id,
  itemTitle: row.item_title,
  pointsSpent: row.points_spent,
  code: row.code,
  createdAt: row.created_at,
});

const mapBatch = (row: DbBatch): BatchRecord => ({
  id: row.id,
  nodeId: row.node_id,
  tonsProcessed: row.tons_processed,
  moisturePercent: row.moisture_percent,
  coarseMulchKg: row.coarse_mulch_kg,
  fineCompostKg: row.fine_compost_kg,
  mediumFiberKg: row.medium_fiber_kg,
  bioPots: row.bio_pots,
  bladeHours: row.blade_hours,
  compostReadyAt: row.compost_ready_at,
  estimatedValueUsd: row.estimated_value_usd,
  createdAt: row.created_at,
});

const toDbTicket = (ticket: PruningTicketRecord) => ({
  id: ticket.id,
  code: ticket.code,
  qr_code_hash: ticket.qrCodeHash,
  qr_payload: ticket.qrPayload,
  user_id: ticket.userId,
  assigned_node_id: ticket.assignedNodeId,
  size_category: ticket.sizeCategory,
  estimated_volume_m3: ticket.estimatedVolumeM3,
  estimated_weight_kg: ticket.estimatedWeightKg,
  points_awarded: ticket.pointsAwarded,
  photo_url: ticket.photoUrl,
  status: ticket.status,
  created_at: ticket.createdAt,
  verified_at: ticket.verifiedAt,
  verified_by: ticket.verifiedBy,
});

const toDbPost = (post: CommunityPostRecord) => ({
  id: post.id,
  user_id: post.userId,
  node_id: post.nodeId,
  author_name: post.authorName,
  author_role: post.authorRole,
  author_avatar: post.authorAvatar,
  location: post.location,
  content: post.content,
  image_url: post.imageUrl,
  kg_contributed: post.kgContributed,
  likes_count: post.likesCount,
  comments_count: post.commentsCount,
  is_challenge: post.isChallenge,
  challenge_goal_kg: post.challengeGoalKg,
  current_kg: post.currentKg,
  end_date: post.endDate,
  participants_count: post.participantsCount,
  tag: post.tag,
  verified_badge: post.verifiedBadge,
  created_at: post.createdAt,
});
