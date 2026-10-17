import type { SizeCategory } from "../config/constants.ts";

export type RepositoryMode = "postgres" | "memory";

export type UserRole = "CITIZEN" | "BRIGADE" | "OPERATOR" | "MUNICIPAL_ADMIN";
export type NodeStatus = "available" | "busy" | "full";
export type TicketStatus = "PENDING" | "VERIFIED" | "CANCELLED";
export type NurseryCategory = "COMPOST" | "PLANT" | "BIOPOT" | "MULCH";

export interface UserRecord {
  id: string;
  name: string;
  role: UserRole;
  district: string;
  avatarUrl: string | null;
  ecoPoints: number;
  totalKgDelivered: number;
  createdAt: string;
}

export interface BioNodeRecord {
  id: string;
  name: string;
  district: string;
  address: string;
  latitude: number;
  longitude: number;
  capacityTonDay: number;
  currentLoadPercent: number;
  status: NodeStatus;
  availableMulchKg: number;
  availableCompostKg: number;
  availableBioPots: number;
  bladeHoursUsed: number;
  coordinator: string | null;
  phone: string | null;
  operatingHours: string | null;
  updatedAt: string;
}

export interface PruningTicketRecord {
  id: string;
  code: string;
  qrCodeHash: string;
  qrPayload: string;
  userId: string;
  assignedNodeId: string;
  sizeCategory: SizeCategory;
  estimatedVolumeM3: number;
  estimatedWeightKg: number;
  pointsAwarded: number;
  photoUrl: string | null;
  status: TicketStatus;
  createdAt: string;
  verifiedAt: string | null;
  verifiedBy: string | null;
}

export interface NurseryItemRecord {
  id: string;
  nodeId: string;
  providerName: string;
  providerAvatar: string | null;
  title: string;
  description: string;
  category: NurseryCategory;
  pointsCost: number;
  branchesKgRequired: number;
  stock: number;
  imageUrl: string | null;
}

export interface CommunityPostRecord {
  id: string;
  userId: string;
  nodeId: string | null;
  authorName: string;
  authorRole: string;
  authorAvatar: string | null;
  location: string;
  content: string;
  imageUrl: string | null;
  kgContributed: number;
  likesCount: number;
  commentsCount: number;
  isChallenge: boolean;
  challengeGoalKg: number | null;
  currentKg: number | null;
  endDate: string | null;
  participantsCount: number | null;
  tag: string | null;
  verifiedBadge: boolean;
  createdAt: string;
}

export interface RedemptionRecord {
  id: string;
  userId: string;
  itemId: string;
  itemTitle: string;
  pointsSpent: number;
  code: string;
  createdAt: string;
}

export interface BatchRecord {
  id: string;
  nodeId: string;
  tonsProcessed: number;
  moisturePercent: number;
  coarseMulchKg: number;
  fineCompostKg: number;
  mediumFiberKg: number;
  bioPots: number;
  bladeHours: number;
  compostReadyAt: string;
  estimatedValueUsd: number;
  createdAt: string;
}

export interface TelemetrySummary {
  totalTonsProcessedWeek: number;
  totalTonsProcessedMonth: number;
  trucksSavedMonth: number;
  bioPotsProducedMonth: number;
  mulchProducedKgMonth: number;
  compostProducedKgMonth: number;
  parkSoilTempReductionC: number;
  waterSavingsPercent: number;
  monthlyFinancialReturnUsd: number;
  capexUsd: number;
  monthlyPaybackMonths: number;
  co2AvoidedKg: number;
  activeNodes: number;
  totalNodes: number;
  avgLoadPercent: number;
  citizensCount: number;
  ticketsVerifiedMonth: number;
  fuelSavingsUsdWeek: number;
}
