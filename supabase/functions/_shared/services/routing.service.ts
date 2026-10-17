import { BIOMASS_DENSITY_KG_PER_M3, FUEL, HOPPER, LANDFILL } from "../config/constants.ts";

/**
 * Enrutamiento inverso de biomasa.
 *
 * Responde la pregunta operativa del Desafío 04:
 * "¿a qué Bio-Nodo le conviene llevar estas ramas, sabiendo que ninguno está lleno
 *  y que el vertedero central queda más lejos?"
 *
 * Algoritmo:
 *  1. Distancia Haversine del origen a cada nodo y al vertedero La Chureca.
 *  2. Peso estimado = volumen × densidad aparente (rama suelta, 120 kg/m³).
 *  3. Se descartan nodos `full` o con carga proyectada > 100%.
 *  4. Score = distancia × (1 + carga/100): castiga nodos ya saturados.
 *  5. Ahorro de diésel = (km_vertedero − km_nodo) × rendimiento × precio.
 */

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface RoutableNode {
  id: string;
  name: string;
  district: string;
  latitude: number;
  longitude: number;
  capacityTonDay: number;
  currentLoadPercent: number;
  status: string;
}

export interface Recommendation {
  node: RoutableNode;
  distanceKm: number;
  estimatedWeightKg: number;
  incomingLoadPercent: number;
  projectedLoadPercent: number;
  nodeRoundTripKm: number;
  landfillDistanceKm: number;
  landfillRoundTripKm: number;
  fuelSavedLiters: number;
  fuelSavedUsd: number;
  fuelSavingsPercent: number;
  trucksSaved: number;
  score: number;
  reason: string;
}

export interface RejectedNode {
  nodeId: string;
  nodeName: string;
  distanceKm: number;
  reason: string;
}

export interface RecommendationResult {
  origin: GeoPoint;
  isMunicipalTruck: boolean;
  volumeM3: number;
  estimatedWeightKg: number;
  recommended: Recommendation | null;
  /** true cuando ningún nodo tenía capacidad y se usó un fallback least-loaded. */
  fallbackApplied: boolean;
  candidates: Array<{
    nodeId: string;
    nodeName: string;
    distanceKm: number;
    currentLoadPercent: number;
    projectedLoadPercent: number;
    eligible: boolean;
  }>;
  rejected: RejectedNode[];
  landfill: GeoPoint & { name: string };
}

const EARTH_RADIUS_KM = 6371;

const toRad = (deg: number): number => (deg * Math.PI) / 180;

/** Distancia ortodrómica (great-circle) en kilómetros. */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));

  return round(EARTH_RADIUS_KM * c, 3);
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function estimatedWeightKg(volumeM3: number): number {
  return round(volumeM3 * BIOMASS_DENSITY_KG_PER_M3, 2);
}

/** % que sumará este lote a la tolva del nodo (capacidad diaria en toneladas). */
export function incomingLoadPercent(weightKg: number, capacityTonDay: number): number {
  if (capacityTonDay <= 0) return 100;
  return round(((weightKg / 1000) / capacityTonDay) * 100, 2);
}

export function nodeStatusFromLoad(loadPercent: number): "available" | "busy" | "full" {
  if (loadPercent >= HOPPER.fullThresholdPercent) return "full";
  if (loadPercent >= HOPPER.busyThresholdPercent) return "busy";
  return "available";
}

export function recommendNode(
  nodes: RoutableNode[],
  origin: GeoPoint,
  volumeM3: number,
  isMunicipalTruck: boolean,
): RecommendationResult {
  const weightKg = estimatedWeightKg(volumeM3);
  const landfillDistanceKm = haversineKm(origin, LANDFILL);
  const litersPerKm = isMunicipalTruck ? FUEL.litersPerKmTruck : FUEL.litersPerKmLight;

  const candidates: RecommendationResult["candidates"] = [];
  const rejected: RejectedNode[] = [];

  const scored: Recommendation[] = [];

  for (const node of nodes) {
    const distanceKm = haversineKm(origin, node);
    const incoming = incomingLoadPercent(weightKg, node.capacityTonDay);
    const projected = round(node.currentLoadPercent + incoming, 2);

    candidates.push({
      nodeId: node.id,
      nodeName: node.name,
      distanceKm,
      currentLoadPercent: node.currentLoadPercent,
      projectedLoadPercent: projected,
      eligible: false,
    });

    if (node.status === "full" || node.currentLoadPercent >= HOPPER.fullThresholdPercent) {
      rejected.push({
        nodeId: node.id,
        nodeName: node.name,
        distanceKm,
        reason: `Tolva saturada (${node.currentLoadPercent}% ≥ ${HOPPER.fullThresholdPercent}%)`,
      });
      continue;
    }

    if (projected > 100) {
      rejected.push({
        nodeId: node.id,
        nodeName: node.name,
        distanceKm,
        reason: `El lote no cabe: ${projected}% de carga proyectada`,
      });
      continue;
    }

    const nodeRoundTripKm = round(distanceKm * 2, 3);
    const landfillRoundTripKm = round(landfillDistanceKm * 2, 3);

    const litersToNode = nodeRoundTripKm * litersPerKm;
    const litersToLandfill = landfillRoundTripKm * litersPerKm;
    const fuelSavedLiters = round(Math.max(0, litersToLandfill - litersToNode), 3);
    const fuelSavedUsd = round(fuelSavedLiters * FUEL.dieselUsdPerLiter, 2);
    const fuelSavingsPercent = litersToLandfill > 0
      ? round((fuelSavedLiters / litersToLandfill) * 100, 1)
      : 0;

    // Reparto de la carga: saturar un nodo cuesta, así que se penaliza su ocupación.
    const score = round(distanceKm * (1 + node.currentLoadPercent / 100), 3);

    scored.push({
      node,
      distanceKm,
      estimatedWeightKg: weightKg,
      incomingLoadPercent: incoming,
      projectedLoadPercent: projected,
      nodeRoundTripKm,
      landfillDistanceKm,
      landfillRoundTripKm,
      fuelSavedLiters,
      fuelSavedUsd,
      fuelSavingsPercent,
      trucksSaved: round(volumeM3 / FUEL.compactionRatio, 2),
      score,
      reason:
        `A ${distanceKm} km, tolva al ${node.currentLoadPercent}% → ${projected}% tras recibir el lote.`,
    });
  }

  scored.sort((a, b) => a.score - b.score);

  let fallbackApplied = false;
  let best = scored[0];

  if (!best && nodes.length > 0) {
    // Fallback explícito: el menos cargado, avisando que no hay capacidad real.
    fallbackApplied = true;
    const leastLoaded = [...nodes].sort((a, b) => a.currentLoadPercent - b.currentLoadPercent)[0];
    const distanceKm = haversineKm(origin, leastLoaded);
    const landfillRoundTripKm = round(landfillDistanceKm * 2, 3);
    const nodeRoundTripKm = round(distanceKm * 2, 3);
    const litersToNode = nodeRoundTripKm * litersPerKm;
    const litersToLandfill = landfillRoundTripKm * litersPerKm;
    const fuelSavedLiters = round(Math.max(0, litersToLandfill - litersToNode), 3);

    best = {
      node: leastLoaded,
      distanceKm,
      estimatedWeightKg: weightKg,
      incomingLoadPercent: incomingLoadPercent(weightKg, leastLoaded.capacityTonDay),
      projectedLoadPercent: round(
        leastLoaded.currentLoadPercent + incomingLoadPercent(weightKg, leastLoaded.capacityTonDay),
        2,
      ),
      nodeRoundTripKm,
      landfillDistanceKm,
      landfillRoundTripKm,
      fuelSavedLiters,
      fuelSavedUsd: round(fuelSavedLiters * FUEL.dieselUsdPerLiter, 2),
      fuelSavingsPercent: litersToLandfill > 0
        ? round((fuelSavedLiters / litersToLandfill) * 100, 1)
        : 0,
      trucksSaved: round(volumeM3 / FUEL.compactionRatio, 2),
      score: round(distanceKm, 3),
      reason:
        "Ningún Bio-Nodo tiene capacidad hoy: se sugiere el menos cargado, coordina con la cuadrilla antes de salir.",
    };
  }

  if (best) {
    const candidate = candidates.find((c) => c.nodeId === best.node.id);
    if (candidate) candidate.eligible = true;
  }

  return {
    origin,
    isMunicipalTruck,
    volumeM3,
    estimatedWeightKg: weightKg,
    recommended: best ?? null,
    fallbackApplied,
    candidates,
    rejected,
    landfill: { ...LANDFILL },
  };
}
