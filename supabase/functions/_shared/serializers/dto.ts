import { SIZE_CATEGORIES, UCT3 } from "../config/constants.ts";
import type { RecommendationResult } from "../services/routing.service.ts";
import type { TripleLayerResult } from "../services/uct3.service.ts";
import type {
  BatchRecord,
  BioNodeRecord,
  CommunityPostRecord,
  NurseryItemRecord,
  PruningTicketRecord,
  RedemptionRecord,
  TelemetrySummary,
  UserRecord,
} from "../data/types.ts";

/**
 * DTOs de la API `/api/v1`.
 *
 * Se devuelven formas "listas para pintar" (etiquetas en español incluidas)
 * para que la app Expo no tenga que duplicar reglas de negocio.
 */

const round = (value: number, decimals = 2): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

export function relativeTimeLabel(iso: string, now: Date = new Date()): string {
  const diffMs = now.getTime() - new Date(iso).getTime();
  const minutes = Math.max(0, Math.round(diffMs / 60000));

  if (minutes < 1) return "Hace instantes";
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Hace ${hours} ${hours === 1 ? "hora" : "horas"}`;
  const days = Math.round(hours / 24);
  if (days === 1) return "Ayer";
  if (days < 7) return `Hace ${days} días`;
  return new Date(iso).toLocaleDateString("es-NI", { day: "numeric", month: "short" });
}

export function levelBadge(totalKgDelivered: number): string {
  if (totalKgDelivered >= 1500) return "Guardián Urbano Nivel 4";
  if (totalKgDelivered >= 750) return "Guardián Urbano Nivel 3";
  if (totalKgDelivered >= 250) return "Guardián Urbano Nivel 2";
  if (totalKgDelivered > 0) return "Semilla Urbana Nivel 1";
  return "Vecino Verde";
}

export function serializeNode(node: BioNodeRecord) {
  return {
    id: node.id,
    name: node.name,
    district: node.district,
    address: node.address,
    latitude: node.latitude,
    longitude: node.longitude,
    coordinates: { latitude: node.latitude, longitude: node.longitude },
    capacityTonDay: node.capacityTonDay,
    /** Alias que usa la UI móvil para pintar la tolva. */
    hopperCapacity: node.currentLoadPercent,
    currentLoadPercent: node.currentLoadPercent,
    status: node.status,
    availableMulchKg: node.availableMulchKg,
    availableCompostKg: node.availableCompostKg,
    availableBioPots: node.availableBioPots,
    bladeHoursUsed: node.bladeHoursUsed,
    bladeAlert: node.bladeHoursUsed >= UCT3.bladeAlertHours,
    coordinator: node.coordinator,
    phone: node.phone,
    operatingHours: node.operatingHours,
    updatedAt: node.updatedAt,
  };
}

export function serializeUser(user: UserRecord) {
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    district: user.district,
    avatarUrl: user.avatarUrl,
    ecoPoints: user.ecoPoints,
    totalKgDelivered: user.totalKgDelivered,
    badge: levelBadge(user.totalKgDelivered),
    createdAt: user.createdAt,
  };
}

export function serializeTicket(ticket: PruningTicketRecord, node?: BioNodeRecord | null) {
  const config = SIZE_CATEGORIES[ticket.sizeCategory];
  return {
    id: ticket.id,
    code: ticket.code,
    qrCodeHash: ticket.qrCodeHash,
    qrPayload: ticket.qrPayload,
    userId: ticket.userId,
    assignedNodeId: ticket.assignedNodeId,
    assignedNode: node ? serializeNode(node) : undefined,
    sizeCategory: ticket.sizeCategory,
    sizeLabel: config.label,
    estimatedVolumeM3: ticket.estimatedVolumeM3,
    estimatedWeightKg: ticket.estimatedWeightKg,
    pointsAwarded: ticket.pointsAwarded,
    photoUrl: ticket.photoUrl,
    status: ticket.status,
    createdAt: ticket.createdAt,
    verifiedAt: ticket.verifiedAt,
  };
}

export function serializeItem(item: NurseryItemRecord, node?: BioNodeRecord | null) {
  return {
    id: item.id,
    nodeId: item.nodeId,
    nodeName: node?.name ?? null,
    providerName: item.providerName,
    providerAvatar: item.providerAvatar,
    title: item.title,
    description: item.description,
    category: item.category,
    pointsCost: item.pointsCost,
    branchesKgRequired: item.branchesKgRequired,
    stock: item.stock,
    imageUrl: item.imageUrl,
    available: item.stock > 0,
  };
}

export function serializeRedemption(redemption: RedemptionRecord) {
  return {
    id: redemption.id,
    code: redemption.code,
    userId: redemption.userId,
    itemId: redemption.itemId,
    itemTitle: redemption.itemTitle,
    pointsSpent: redemption.pointsSpent,
    createdAt: redemption.createdAt,
    timeAgo: relativeTimeLabel(redemption.createdAt),
  };
}

export function serializePost(
  post: CommunityPostRecord,
  node?: BioNodeRecord | null,
  nodeNameFallback?: string | null,
) {
  return {
    id: post.id,
    userId: post.userId,
    nodeId: post.nodeId,
    nodeName: node?.name ?? nodeNameFallback ?? null,
    authorName: post.authorName,
    authorRole: post.authorRole,
    authorAvatar: post.authorAvatar,
    location: post.location,
    content: post.content,
    imageUrl: post.imageUrl,
    kgContributed: post.kgContributed,
    podaKg: post.kgContributed,
    likesCount: post.likesCount,
    commentsCount: post.commentsCount,
    isChallenge: post.isChallenge,
    challengeGoalKg: post.challengeGoalKg,
    currentKg: post.currentKg,
    progressPercent: post.isChallenge && post.challengeGoalKg
      ? round(Math.min(100, ((post.currentKg ?? 0) / post.challengeGoalKg) * 100), 1)
      : null,
    endDate: post.endDate,
    participantsCount: post.participantsCount,
    tag: post.tag,
    verifiedBadge: post.verifiedBadge,
    createdAt: post.createdAt,
    timeAgo: relativeTimeLabel(post.createdAt),
  };
}

export function serializeBatch(batch: BatchRecord) {
  return {
    id: batch.id,
    nodeId: batch.nodeId,
    tonsProcessed: batch.tonsProcessed,
    moisturePercent: batch.moisturePercent,
    coarseMulchKg: batch.coarseMulchKg,
    fineCompostKg: batch.fineCompostKg,
    mediumFiberKg: batch.mediumFiberKg,
    bioPots: batch.bioPots,
    bladeHours: batch.bladeHours,
    compostReadyAt: batch.compostReadyAt,
    estimatedValueUsd: batch.estimatedValueUsd,
    createdAt: batch.createdAt,
  };
}

/** Respuesta del motor UCT-3 con etiquetas listas para la UI. */
export function serializeBatchResult(result: TripleLayerResult) {
  return {
    ...result,
    fractionsPercent: {
      coarseM25: round(result.fractions.coarseM25 * 100, 1),
      fineM8: round(result.fractions.fineM8 * 100, 1),
      medium8to25: round(result.fractions.medium8to25 * 100, 1),
    },
    outputs: {
      mulch: {
        kg: result.coarseMulchKg,
        tons: round(result.coarseMulchKg / 1000, 3),
        label: `Mulch térmico (Día 1)`,
        coverageM2: result.mulchCoverageM2,
      },
      compost: {
        kg: result.fineCompostKg,
        tons: round(result.fineCompostKg / 1000, 3),
        label: `Compost rápido (${result.compostCycleDays} días)`,
        readyAt: result.compostReadyAt,
      },
      bioPots: {
        units: result.bioPots,
        fiberKg: result.mediumFiberKg,
        label: "Bio-Macetas biodegradables",
      },
    },
  };
}

/** Respuesta de `POST /nodes/recommend`. */
export function serializeRecommendation(result: RecommendationResult) {
  return {
    ...result,
    summary: result.recommended
      ? `Lleva tu poda a ${result.recommended.node.name}: ahorras $${result.recommended.fuelSavedUsd} de diésel (${result.recommended.fuelSavingsPercent}%) frente al vertedero.`
      : "No hay Bio-Nodos con capacidad en este momento. Coordina con la cuadrilla municipal.",
  };
}

export function serializeTelemetry(summary: TelemetrySummary) {
  return {
    ...summary,
    labels: {
      totalTonsProcessedWeek: `${round(summary.totalTonsProcessedWeek, 1)} Ton`,
      trucksSavedMonth: `${Math.round(summary.trucksSavedMonth)} viajes`,
      bioPotsProducedMonth: `${summary.bioPotsProducedMonth.toLocaleString("es-NI")} uds`,
      parkSoilTempReductionC: `-${summary.parkSoilTempReductionC} °C`,
      waterSavingsPercent: `${summary.waterSavingsPercent}%`,
      monthlyFinancialReturnUsd: `$${
        summary.monthlyFinancialReturnUsd.toLocaleString("es-NI")
      } USD`,
      capexUsd: `$${summary.capexUsd.toLocaleString("es-NI")} USD`,
      co2AvoidedKg: `${summary.co2AvoidedKg.toLocaleString("es-NI")} kg CO₂`,
    },
    generatedAt: new Date().toISOString(),
  };
}

export function serializeError(code: string, message: string, details?: unknown) {
  return { error: { code, message, details } };
}
