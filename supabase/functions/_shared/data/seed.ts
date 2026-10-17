import type {
  BatchRecord,
  BioNodeRecord,
  CommunityPostRecord,
  NurseryItemRecord,
  PruningTicketRecord,
  RedemptionRecord,
  UserRecord,
} from "./types.ts";
import { computeTripleLayer } from "../services/uct3.service.ts";

/**
 * Datos semilla de Managua.
 *
 * Este archivo alimenta el MODO DEMO (repositorio en memoria) para que
 * `npm run dev` funcione sin credenciales de Supabase. El mismo dataset se
 * replica en `supabase/migrations/*_seed.sql` (fuente de verdad para producción);
 * los valores derivados del lote UCT-3 se generan con el propio motor físico
 * (ver `scripts/generate-seed-sql.ts`) para que ambos lados coincidan.
 */

export const SEED_NODES: BioNodeRecord[] = [
  {
    id: "node-luis-alfonso",
    name: "Bio-Nodo Parque Luis Alfonso Velásquez",
    district: "Distrito II",
    address: "Av. Bolívar, Centro Histórico de Managua",
    latitude: 12.1445,
    longitude: -86.2735,
    capacityTonDay: 3.5,
    currentLoadPercent: 45,
    status: "available",
    availableMulchKg: 920,
    availableCompostKg: 410,
    availableBioPots: 64,
    bladeHoursUsed: 18.5,
    coordinator: "Cuadrilla Municipal Centro",
    phone: "+505 8731-9014",
    operatingHours: "Lun - Dom: 6:30 AM - 5:00 PM",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "node-las-madres",
    name: "Bio-Nodo Parque Las Madres",
    district: "Distrito I",
    address: "Costado Sur, Rotonda El Güegüense, Managua",
    latitude: 12.1328,
    longitude: -86.2764,
    capacityTonDay: 2.5,
    currentLoadPercent: 78,
    status: "busy",
    availableMulchKg: 1240,
    availableCompostKg: 300,
    availableBioPots: 48,
    bladeHoursUsed: 31.2,
    coordinator: "Brigada Verde Bolonia",
    phone: "+505 8890-4122",
    operatingHours: "Lun - Sáb: 7:00 AM - 4:30 PM",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "node-plantel-noroeste",
    name: "Bio-Nodo Plantel Noroeste Alcaldía",
    district: "Distrito II",
    address: "Km 6 Carretera Norte, entrada a San Sebastián",
    latitude: 12.152,
    longitude: -86.288,
    capacityTonDay: 5.0,
    currentLoadPercent: 92,
    status: "full",
    availableMulchKg: 2100,
    availableCompostKg: 760,
    availableBioPots: 132,
    bladeHoursUsed: 42.5,
    coordinator: "Gestión Ambiental ALMA",
    phone: "+505 8920-5571",
    operatingHours: "Lun - Vie: 6:00 AM - 3:30 PM",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "node-japones",
    name: "Bio-Nodo Parque Japonés / Distrito I",
    district: "Distrito I",
    address: "Los Robles, frente a Plaza Cuba, Managua",
    latitude: 12.122,
    longitude: -86.265,
    capacityTonDay: 2.0,
    currentLoadPercent: 30,
    status: "available",
    availableMulchKg: 680,
    availableCompostKg: 210,
    availableBioPots: 26,
    bladeHoursUsed: 9.4,
    coordinator: "Comité Ecológico Los Robles",
    phone: "+505 8452-1190",
    operatingHours: "Mar - Dom: 7:00 AM - 4:00 PM",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "node-tiscapa",
    name: "Bio-Nodo Reserva Laguna de Tiscapa",
    district: "Distrito I",
    address: "Paseo Tiscapa, entrada Mirador Histórico, Barrio Jonathan González",
    latitude: 12.1388,
    longitude: -86.2715,
    capacityTonDay: 3.0,
    currentLoadPercent: 38,
    status: "available",
    availableMulchKg: 850,
    availableCompostKg: 340,
    availableBioPots: 52,
    bladeHoursUsed: 14.0,
    coordinator: "Guardaparques Tiscapa MARENA (Brenda Chamorro)",
    phone: "+505 8645-7720",
    operatingHours: "Mar - Dom: 6:00 AM - 4:00 PM",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "node-huembes",
    name: "Bio-Nodo Mercado Roberto Huembes",
    district: "Distrito V",
    address: "Pista de la Solidaridad, Costado Este del Vivero San Cristóbal",
    latitude: 12.1215,
    longitude: -86.2430,
    capacityTonDay: 4.0,
    currentLoadPercent: 88,
    status: "busy",
    availableMulchKg: 1820,
    availableCompostKg: 520,
    availableBioPots: 95,
    bladeHoursUsed: 36.8,
    coordinator: "Asociación de Acopio Verde (Don Manuel Rivas)",
    phone: "+505 8511-9344",
    operatingHours: "Lun - Sáb: 6:00 AM - 3:00 PM",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "node-conchita-palacios",
    name: "Bio-Nodo Villa Progreso / Conchita Palacios",
    district: "Distrito VII",
    address: "Rotonda La Virgen 500m al Sur, entrada Complejo Deportivo",
    latitude: 12.1415,
    longitude: -86.2240,
    capacityTonDay: 2.5,
    currentLoadPercent: 52,
    status: "available",
    availableMulchKg: 740,
    availableCompostKg: 290,
    availableBioPots: 38,
    bladeHoursUsed: 22.1,
    coordinator: "Comité Comunal Villa Progreso (Ricardo Gutiérrez)",
    phone: "+505 8799-3105",
    operatingHours: "Lun - Sáb: 7:00 AM - 4:00 PM",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "node-unan-universidad",
    name: "Bio-Nodo Universitario UNAN-Managua",
    district: "Distrito I",
    address: "Pista Juan Pablo II, entrada Portón 2 Recinto Rubén Darío",
    latitude: 12.1150,
    longitude: -86.2710,
    capacityTonDay: 3.0,
    currentLoadPercent: 24,
    status: "available",
    availableMulchKg: 510,
    availableCompostKg: 180,
    availableBioPots: 30,
    bladeHoursUsed: 11.2,
    coordinator: "Movimiento Ambientalista Universitario (Claudia Morales)",
    phone: "+505 8332-6718",
    operatingHours: "Lun - Vie: 7:30 AM - 5:00 PM",
    updatedAt: new Date().toISOString(),
  },
];

export const SEED_USERS: UserRecord[] = [
  {
    id: "user-jose",
    name: "José Mendoza",
    role: "CITIZEN",
    district: "Distrito I",
    avatarUrl:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80",
    ecoPoints: 485,
    totalKgDelivered: 1280,
    createdAt: new Date().toISOString(),
  },
  {
    id: "user-martha",
    name: "Doña Martha Rivas",
    role: "CITIZEN",
    district: "Distrito I",
    avatarUrl:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&auto=format&fit=crop&q=80",
    ecoPoints: 210,
    totalKgDelivered: 96,
    createdAt: new Date().toISOString(),
  },
  {
    id: "user-marcos",
    name: "Marcos Zelaya",
    role: "BRIGADE",
    district: "Distrito II",
    avatarUrl:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80",
    ecoPoints: 640,
    totalKgDelivered: 742,
    createdAt: new Date().toISOString(),
  },
  {
    id: "user-operador-carmen",
    name: "Carmen Ruiz",
    role: "OPERATOR",
    district: "Distrito II",
    avatarUrl:
      "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80",
    ecoPoints: 0,
    totalKgDelivered: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: "user-alma",
    name: "Alma Lagos",
    role: "MUNICIPAL_ADMIN",
    district: "Distrito III",
    avatarUrl:
      "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&auto=format&fit=crop&q=80",
    ecoPoints: 0,
    totalKgDelivered: 0,
    createdAt: new Date().toISOString(),
  },
];

export const SEED_NURSERY_ITEMS: NurseryItemRecord[] = [
  {
    id: "item-abono-5kg",
    nodeId: "node-las-madres",
    providerName: "Brigada Verde Bolonia",
    providerAvatar:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80",
    title: "Abono Rápido 5kg",
    description:
      "Compost barrial orgánico madurado a 28 días con microorganismos eficientes de Managua.",
    category: "COMPOST",
    pointsCost: 40,
    branchesKgRequired: 15,
    stock: 48,
    imageUrl:
      "https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=500&auto=format&fit=crop&q=80",
  },
  {
    id: "item-madero-negro",
    nodeId: "node-japones",
    providerName: "Comité Ecológico Los Robles",
    providerAvatar:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80",
    title: "Planta Madero Negro",
    description:
      "Especie nativa fijadora de nitrógeno para sombra y regeneración de microclimas urbanos.",
    category: "PLANT",
    pointsCost: 50,
    branchesKgRequired: 25,
    stock: 22,
    imageUrl:
      "https://images.unsplash.com/photo-1509423350716-97f9360b4e09?w=500&auto=format&fit=crop&q=80",
  },
  {
    id: "item-biomaceta",
    nodeId: "node-luis-alfonso",
    providerName: "Cuadrilla Municipal Centro",
    providerAvatar:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80",
    title: "Pack 10 Bio-Macetas",
    description:
      "Fabricadas con fibra de poda triturada y aglutinante vegetal. Se plantan directo en tierra.",
    category: "BIOPOT",
    pointsCost: 25,
    branchesKgRequired: 10,
    stock: 65,
    imageUrl:
      "https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=500&auto=format&fit=crop&q=80",
  },
  {
    id: "item-mulch-10kg",
    nodeId: "node-plantel-noroeste",
    providerName: "Gestión Ambiental ALMA",
    providerAvatar:
      "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&auto=format&fit=crop&q=80",
    title: "Mulch Térmico 10kg",
    description:
      "Corteza y astillas para cobertura de suelo: reduce 6.5°C la evaporación y ahorra 50% de agua.",
    category: "MULCH",
    pointsCost: 30,
    branchesKgRequired: 20,
    stock: 90,
    imageUrl:
      "https://images.unsplash.com/photo-1599685315640-9ceab2f58944?w=500&auto=format&fit=crop&q=80",
  },
  {
    id: "item-sacuanjoche-flor",
    nodeId: "node-tiscapa",
    providerName: "Vivero El Bosquecito Tiscapa",
    providerAvatar:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80",
    title: "Plántula de Sacuanjoche (Flor Nacional)",
    description:
      "Plumeria rubra. Resistente a sequía y altas temperaturas de Managua. Flores emblemáticas con fragancia cítrica.",
    category: "PLANT",
    pointsCost: 45,
    branchesKgRequired: 18,
    stock: 28,
    imageUrl:
      "https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?w=500&auto=format&fit=crop&q=80",
  },
  {
    id: "item-biofertilizante-1l",
    nodeId: "node-huembes",
    providerName: "Cooperativa Agroecológica Huembes",
    providerAvatar:
      "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=200&auto=format&fit=crop&q=80",
    title: "Bio-Fertilizante Foliar Enriquecido (1 Litro)",
    description:
      "Lixiviado de compost UCT-3 con extractos botánicos de neem. Repelente natural de plagas y vigorizante de follaje.",
    category: "COMPOST",
    pointsCost: 35,
    branchesKgRequired: 15,
    stock: 40,
    imageUrl:
      "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=500&auto=format&fit=crop&q=80",
  },
  {
    id: "item-kit-huerto-managua",
    nodeId: "node-unan-universidad",
    providerName: "Facultad Agropecuaria UNAN",
    providerAvatar:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80",
    title: "Kit Huerto Urbano Managua (Semillas + Sustrato)",
    description:
      "Incluye semillas criollas de tomate y chiltoma nativa, 2 Bio-Macetas biodegradables y 3 kg de sustrato compostado.",
    category: "BIOPOT",
    pointsCost: 60,
    branchesKgRequired: 25,
    stock: 20,
    imageUrl:
      "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=500&auto=format&fit=crop&q=80",
  },
];

export const SEED_POSTS: CommunityPostRecord[] = [
  {
    id: "post-1",
    userId: "user-martha",
    nodeId: "node-las-madres",
    authorName: "Doña Martha Rivas",
    authorRole: "Vecina de Bolonia",
    authorAvatar:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&auto=format&fit=crop&q=80",
    location: "Distrito I, Managua",
    content:
      "¡Hola vecinos! Hoy completamos la poda preventiva del patio y llevamos 25 kg de ramas secas al Bio-Nodo del Parque Las Madres. El proceso de triturado fue súper rápido y ya canjeamos nuestro compost de 28 días 🌱.",
    imageUrl:
      "https://images.unsplash.com/photo-1592150621744-aca64f48394a?w=800&auto=format&fit=crop&q=80",
    kgContributed: 25,
    likesCount: 64,
    commentsCount: 18,
    isChallenge: false,
    challengeGoalKg: null,
    currentKg: null,
    endDate: null,
    participantsCount: null,
    tag: null,
    verifiedBadge: true,
    createdAt: hoursAgo(0.75),
  },
  {
    id: "post-2",
    userId: "user-marcos",
    nodeId: "node-luis-alfonso",
    authorName: "Marcos Zelaya",
    authorRole: "Jardinero Urbano Independiente",
    authorAvatar:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80",
    location: "Distrito II, San Antonio",
    content:
      "Descargando carretilla completa en el Bio-Nodo Luis Alfonso. En vez de quemar o botar las ramas en cauces, aquí se transforman en mulch térmico. ¡Menos calor y más tierra sana para nuestra ciudad!",
    imageUrl:
      "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&auto=format&fit=crop&q=80",
    kgContributed: 85,
    likesCount: 92,
    commentsCount: 11,
    isChallenge: false,
    challengeGoalKg: null,
    currentKg: null,
    endDate: null,
    participantsCount: null,
    tag: null,
    verifiedBadge: true,
    createdAt: hoursAgo(2),
  },
  {
    id: "post-3",
    userId: "user-marcos",
    nodeId: "node-japones",
    authorName: "Cuadrilla Verde Nica",
    authorRole: "Voluntariado Ambiental",
    authorAvatar:
      "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80",
    location: "Los Robles, Managua",
    content:
      "Jornada dominical en Los Robles. Entregamos 240 kg de biomasa triturada al nodo Parque Japonés. ¡Canjeamos 6 Bio-Macetas para reforestar el parque infantil!",
    imageUrl:
      "https://images.unsplash.com/photo-1588880331179-bc9b93a8cb5e?w=800&auto=format&fit=crop&q=80",
    kgContributed: 240,
    likesCount: 178,
    commentsCount: 34,
    isChallenge: false,
    challengeGoalKg: null,
    currentKg: null,
    endDate: null,
    participantsCount: null,
    tag: null,
    verifiedBadge: true,
    createdAt: hoursAgo(5),
  },
  {
    id: "challenge-1",
    userId: "user-marcos",
    nodeId: "node-las-madres",
    authorName: "Ing. Carlos Mendoza",
    authorRole: "Coordinador de Reto",
    authorAvatar:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80",
    location: "Las Colinas, Managua",
    content: "Reto Poda Verde Las Colinas",
    imageUrl:
      "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=800&auto=format&fit=crop&q=80",
    kgContributed: 940,
    likesCount: 56,
    commentsCount: 12,
    isChallenge: true,
    challengeGoalKg: 1500,
    currentKg: 940,
    endDate: "Domingo 5:00 PM",
    participantsCount: 38,
    tag: "Meta Biomasa Fin de Semana",
    verifiedBadge: true,
    createdAt: hoursAgo(26),
  },
  {
    id: "challenge-2",
    userId: "user-martha",
    nodeId: "node-japones",
    authorName: "Valeria Solís",
    authorRole: "Coordinadora de Reto",
    authorAvatar:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80",
    location: "Villa Fontana Sur",
    content: "Brigada Limpieza Villa Fontana",
    imageUrl:
      "https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?w=800&auto=format&fit=crop&q=80",
    kgContributed: 1620,
    likesCount: 88,
    commentsCount: 21,
    isChallenge: true,
    challengeGoalKg: 2000,
    currentKg: 1620,
    endDate: "Sábado 2:00 PM",
    participantsCount: 52,
    tag: "Comunidad Activa",
    verifiedBadge: true,
    createdAt: hoursAgo(30),
  },
];

/** Vales de ejemplo para que la billetera y el operador tengan datos al abrir la app. */
export const SEED_TICKETS: PruningTicketRecord[] = [
  {
    id: "ticket-demo-pending",
    code: "BIORED-MADRES-4821",
    qrCodeHash: "a2f1d0e4b7c94f6b1f0a2c3d4e5f60718293a4b5c6d7e8f9012345678abcdef",
    qrPayload: "BIORED::VALE::BIORED-MADRES-4821::MADRES::0.8M3::35PTS",
    userId: "user-jose",
    assignedNodeId: "node-las-madres",
    sizeCategory: "md",
    estimatedVolumeM3: 0.8,
    estimatedWeightKg: 96,
    pointsAwarded: 35,
    photoUrl: null,
    status: "PENDING",
    createdAt: hoursAgo(1),
    verifiedAt: null,
    verifiedBy: null,
  },
  {
    id: "ticket-demo-verified",
    code: "BIORED-LUIS-AL-7410",
    qrCodeHash: "b1c2d3e4f5061728394a5b6c7d8e9f0a1b2c3d4e5f60718293a4b5c6d7e8f901",
    qrPayload: "BIORED::VALE::BIORED-LUIS-AL-7410::LUIS-AL::2.5M3::100PTS",
    userId: "user-jose",
    assignedNodeId: "node-luis-alfonso",
    sizeCategory: "lg",
    estimatedVolumeM3: 2.5,
    estimatedWeightKg: 300,
    pointsAwarded: 100,
    photoUrl: null,
    status: "VERIFIED",
    createdAt: daysAgo(4),
    verifiedAt: daysAgo(4),
    verifiedBy: "user-operador-carmen",
  },
];

export const SEED_REDEMPTIONS: RedemptionRecord[] = [
  {
    id: "redemption-demo-1",
    userId: "user-jose",
    itemId: "item-biomaceta",
    itemTitle: "Pack 10 Bio-Macetas",
    pointsSpent: 25,
    code: "CANJE-BIO-2QK7P",
    createdAt: daysAgo(6),
  },
];

/**
 * Lotes procesados por la UCT-3.
 * Las salidas físicas se calculan con el motor real (no se escriben a mano),
 * así el modo demo y Postgres cuentan exactamente la misma historia.
 */
export const SEED_BATCHES: BatchRecord[] = [
  batch("batch-01", "node-las-madres", 1, 4.1, 62),
  batch("batch-02", "node-luis-alfonso", 3, 4.0, 45),
  batch("batch-03", "node-japones", 5, 4.2, 28),
  batch("batch-04", "node-luis-alfonso", 9, 3.2, 30),
  batch("batch-05", "node-plantel-noroeste", 12, 3.8, 55),
  batch("batch-06", "node-las-madres", 16, 4.5, 22),
  batch("batch-07", "node-japones", 20, 3.9, 35),
  batch("batch-08", "node-plantel-noroeste", 24, 4.4, 40),
  batch("batch-09", "node-luis-alfonso", 28, 3.6, 26),
  batch("batch-10", "node-las-madres", 33, 4.1, 30),
  batch("batch-11", "node-japones", 38, 3.5, 25),
];

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function batch(
  id: string,
  nodeId: string,
  daysAgoCount: number,
  tonsProcessed: number,
  moisturePercent: number,
): BatchRecord {
  const createdAt = new Date(Date.now() - daysAgoCount * 24 * 60 * 60 * 1000);
  const result = computeTripleLayer(tonsProcessed, moisturePercent, createdAt);

  return {
    id,
    nodeId,
    tonsProcessed,
    moisturePercent,
    coarseMulchKg: result.coarseMulchKg,
    fineCompostKg: result.fineCompostKg,
    mediumFiberKg: result.mediumFiberKg,
    bioPots: result.bioPots,
    bladeHours: result.bladeHoursUsed,
    compostReadyAt: result.compostReadyAt,
    estimatedValueUsd: result.estimatedValueUsd,
    createdAt: createdAt.toISOString(),
  };
}
