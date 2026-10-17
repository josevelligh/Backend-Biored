import { z } from "npm:zod@4";
import { AppError, unprocessable } from "../lib/errors.ts";

/**
 * Validación estricta de `body`, `query` y `params` con zod.
 * Toda entrada inválida se convierte en un 422 con la lista de campos fallidos.
 */
export function parseOrThrow<S extends z.ZodType>(
  schema: S,
  data: unknown,
  context = "request",
): z.output<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw unprocessable(
      "VALIDATION_ERROR",
      `Datos inválidos en ${context}`,
      result.error.issues.map((issue) => ({
        field: issue.path.map(String).join(".") || context,
        message: issue.message,
      })),
    );
  }
  return result.data;
}

/** Valida y convierte parámetros de ruta/query (siempre llegan como string). */
export function parseIntParam(value: string | null, fallback: number): number {
  if (value === null || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new AppError(400, "INVALID_QUERY_PARAM", `Valor numérico inválido: ${value}`);
  }
  return Math.trunc(parsed);
}

// ---------------------------------------------------------------------------
// Esquemas compartidos
// ---------------------------------------------------------------------------

const latitude = z.number().min(-90).max(90);
const longitude = z.number().min(-180).max(180);

export const geoPointSchema = z.object({
  latitude,
  longitude,
});

export const sizeCategorySchema = z.enum(["sm", "md", "lg"]);

/** `POST /nodes/recommend` */
export const recommendNodeSchema = z.object({
  latitude,
  longitude,
  volumeM3: z.number().min(0.01).max(60).default(0.8),
  isMunicipalTruck: z.boolean().default(false),
  /** Opcional: filtra solo nodos de un distrito concreto. */
  district: z.string().trim().min(1).max(60).optional(),
});

/** `POST /nodes/:id/process-batch` — operario de la UCT-3. */
export const processBatchSchema = z.object({
  tonsProcessed: z.number().gt(0).max(200),
  moisturePercent: z.number().min(0).max(100),
  operatorId: z.string().trim().min(1).optional(),
  notes: z.string().trim().max(280).optional(),
});

/** `POST /pruning/tickets` */
export const createTicketSchema = z.object({
  userId: z.string().trim().min(1),
  sizeCategory: sizeCategorySchema,
  photoUrl: z.string().trim().url().optional(),
  latitude: latitude.optional(),
  longitude: longitude.optional(),
  /** Si el vecino ya viene desde el mapa con un nodo preseleccionado. */
  assignedNodeId: z.string().trim().min(1).optional(),
});

/** `POST /pruning/verify-qr` */
export const verifyQrSchema = z.object({
  qrCodeHash: z.string().trim().min(4),
  operatorId: z.string().trim().min(1),
});

/** `POST /marketplace/redeem` */
export const redeemSchema = z.object({
  userId: z.string().trim().min(1),
  itemId: z.string().trim().min(1),
});

/** `POST /community/posts` */
export const createPostSchema = z.object({
  userId: z.string().trim().min(1),
  content: z.string().trim().min(3).max(600),
  nodeId: z.string().trim().min(1).optional(),
  imageUrl: z.string().trim().url().optional(),
  kgContributed: z.number().min(0).max(5000).default(0),
});

/** `POST /community/challenges` */
export const createChallengeSchema = z.object({
  title: z.string().trim().min(3).max(120),
  coordinatorId: z.string().trim().min(1),
  neighborhood: z.string().trim().min(3).max(120),
  challengeGoalKg: z.number().gt(0).max(50000),
  endDate: z.string().trim().min(1).max(60),
  tag: z.string().trim().max(60).optional(),
  coverImage: z.string().trim().url().optional(),
});

/** `POST /community/posts/:id/like` */
export const likeSchema = z.object({
  delta: z.number().int().min(-1).max(1).default(1),
});

export type RecommendNodeInput = z.output<typeof recommendNodeSchema>;
export type ProcessBatchInput = z.output<typeof processBatchSchema>;
export type CreateTicketInput = z.output<typeof createTicketSchema>;
export type VerifyQrInput = z.output<typeof verifyQrSchema>;
export type RedeemInput = z.output<typeof redeemSchema>;
export type CreatePostInput = z.output<typeof createPostSchema>;
export type CreateChallengeInput = z.output<typeof createChallengeSchema>;
