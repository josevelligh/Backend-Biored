import type {
  BatchRecord,
  BioNodeRecord,
  CommunityPostRecord,
  NurseryItemRecord,
  PruningTicketRecord,
  RedemptionRecord,
  RepositoryMode,
  UserRecord,
} from "./types.ts";

/** Resultado atómico de escanear un vale QR. */
export interface VerifyTicketResult {
  ticket: PruningTicketRecord;
  user: UserRecord;
  node: BioNodeRecord;
}

/** Resultado atómico de un canje en el vivero. */
export interface RedeemResult {
  user: UserRecord;
  item: NurseryItemRecord;
  redemption: RedemptionRecord;
}

/** Resultado atómico de procesar un lote en la UCT-3. */
export interface ApplyBatchResult {
  batch: BatchRecord;
  node: BioNodeRecord;
}

/**
 * Puerto de persistencia (Clean Architecture): los controladores dependen de esta
 * interfaz, no de Postgres. Hay dos adaptadores:
 *   - `postgres.repo.ts` → Supabase Postgres (producción / APK)
 *   - `memory.repo.ts`   → datos semilla en memoria (demo local sin credenciales)
 */
export interface BioRedRepo {
  readonly mode: RepositoryMode;

  listNodes(): Promise<BioNodeRecord[]>;
  getNode(id: string): Promise<BioNodeRecord | null>;

  listUsers(): Promise<UserRecord[]>;
  getUser(id: string): Promise<UserRecord | null>;

  createTicket(ticket: PruningTicketRecord): Promise<PruningTicketRecord>;
  /** Busca por hash QR, código legible o payload escaneado. */
  findTicket(lookup: string): Promise<PruningTicketRecord | null>;
  listTicketsByUser(userId: string): Promise<PruningTicketRecord[]>;
  listTickets(): Promise<PruningTicketRecord[]>;
  verifyTicket(
    lookup: string,
    operatorId: string,
    loadDeltaPercent: number,
  ): Promise<VerifyTicketResult>;

  listNurseryItems(): Promise<NurseryItemRecord[]>;
  getNurseryItem(id: string): Promise<NurseryItemRecord | null>;
  redeem(userId: string, itemId: string, redemptionCode: string): Promise<RedeemResult>;
  listRedemptionsByUser(userId: string): Promise<RedemptionRecord[]>;

  listPosts(): Promise<CommunityPostRecord[]>;
  createPost(post: CommunityPostRecord): Promise<CommunityPostRecord>;
  likePost(id: string, delta: number): Promise<CommunityPostRecord | null>;

  applyBatch(batch: BatchRecord, loadDeltaPercent: number): Promise<ApplyBatchResult>;
  listBatches(): Promise<BatchRecord[]>;
}
