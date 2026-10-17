/**
 * Constantes físicas, operativas y económicas del sistema BioRed.
 *
 * Centralizar estos números aquí permite que:
 *  - el motor UCT-3, el enrutamiento y la telemetría compartan una única verdad;
 *  - el pitch pueda ajustar factores (humedad, precio del diésel, CAPEX) sin tocar lógica.
 */

/** Motor físico de conversión tricapa de la máquina UCT-3 (cilindro Trommel). */
export const UCT3 = {
  /**
   * Distribución tricapa base, medida con humedad de referencia (30%).
   *  - coarse (>25 mm): mulch térmico listo el Día 1
   *  - fine   (<8 mm):  compost rápido aireado (28 días)
   *  - medium (8-25 mm): fibra leñosa para prensar Bio-Macetas biodegradables
   */
  baseFractions: {
    coarseM25: 0.5,
    fineM8: 0.35,
    medium8to25: 0.15,
  },

  /** Humedad (%) para la que la distribución base es exacta. */
  referenceMoisturePercent: 30,

  /** Pendiente de ajuste: cada punto de humedad extra engrosa el trommel. */
  coarseMoistureSensitivity: 0.004, // +0.4% de grueso por cada % de humedad
  fineMoistureSensitivity: 0.006, // -0.6% de fino por cada % de humedad

  /** Límites de seguridad para evitar fracciones absurdas. */
  coarseRange: [0.35, 0.62] as const,
  fineRange: [0.18, 0.45] as const,
  mediumRange: [0.08, 0.3] as const,

  /** Rendimiento agronómico del mulch térmico. */
  mulchCoverageM2PerTon: 25, // 1 Ton ≈ 25 m² de parque protegido
  mulchTempReductionC: 6.5, // -6.5 °C de temperatura del suelo
  mulchWaterSavingsPercent: 50, // 50% de ahorro de agua

  /** Ciclo del compost rápido aireado. */
  compostCycleDays: 28,

  /** Fibra media → prensa de Bio-Macetas. */
  bioPotsPerTonMedium: 210,

  /** Desgaste de cuchillas de acero 5160. */
  bladeHoursPerTon: 0.35,
  bladeAlertHours: 40,

  /** Precios de referencia del producto terminado (mercado Managua). */
  mulchUsdPerTon: 45,
  compostUsdPerTon: 120,
  bioPotUsd: 0.9,
} as const;

/** Densidad aparente de rama suelta municipal (kg/m³) para estimar peso desde volumen. */
export const BIOMASS_DENSITY_KG_PER_M3 = 120;

/** Categorías de acopio del vecino: volumen y Eco-Puntos del vale QR. */
export const SIZE_CATEGORIES = {
  sm: { volumeM3: 0.2, points: 10, label: "Bolsa" },
  md: { volumeM3: 0.8, points: 35, label: "Carretilla" },
  lg: { volumeM3: 2.5, points: 100, label: "Camioneta" },
} as const;

export type SizeCategory = keyof typeof SIZE_CATEGORIES;

/** Reglas de ocupación de tolva de un Bio-Nodo. */
export const HOPPER = {
  /** A partir de este % de carga el nodo deja de recibir biomasa. */
  fullThresholdPercent: 90,
  /** Umbral de "alta demanda" (se marca `busy`). */
  busyThresholdPercent: 70,
} as const;

/** Vertedero central de Managua (La Chureca) — línea base de comparación de rutas. */
export const LANDFILL = {
  name: "Vertedero Central La Chureca",
  latitude: 12.1622,
  longitude: -86.3075,
} as const;

/** Modelo de consumo y precio de combustible (NIC). */
export const FUEL = {
  dieselUsdPerLiter: 1.32,
  litersPerKmLight: 0.12, // vecino en vehículo liviano
  litersPerKmTruck: 0.38, // camión municipal cargado
  /** Compactación logística: 5 m³ de biomasa municipal equivalen a 1 viaje al vertedero. */
  compactionRatio: 5,
  /**
   * Diésel evitado por tonelada que no viaja al vertedero.
   * Derivación: 9.5 km de ida y vuelta evitados × 0.38 L/km ÷ 1.5 t por viaje ≈ 2.4 L/t.
   */
  litersSavedPerTonBiomass: 2.4,
} as const;

/** Retorno financiero del sistema (numeros del documento de factibilidad). */
export const ECONOMICS = {
  capexUsd: 1200,
  monthlyReturnUsd: 1140,
} as const;

/** Impacto ambiental por kg de biomasa desviada del vertedero. */
export const IMPACT = {
  co2AvoidedKgPerKg: 0.715,
  weeklyTargetTons: 12.4,
} as const;

/** Nodo por defecto cuando ningún Bio-Nodo tiene capacidad (fallback explícito). */
export const API = {
  version: "v1",
  basePath: "/api/v1",
  landfillName: LANDFILL.name,
} as const;
