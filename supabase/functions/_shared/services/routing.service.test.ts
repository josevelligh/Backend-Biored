import { assert, assertAlmostEquals, assertEquals } from "jsr:@std/assert@1";
import {
  estimatedWeightKg,
  haversineKm,
  incomingLoadPercent,
  nodeStatusFromLoad,
  recommendNode,
  type RoutableNode,
} from "./routing.service.ts";
import { BIOMASS_DENSITY_KG_PER_M3, HOPPER, LANDFILL } from "../config/constants.ts";

const node = (overrides: Partial<RoutableNode> & { id: string }): RoutableNode => ({
  name: `Nodo ${overrides.id}`,
  district: "Distrito I",
  latitude: 12.13,
  longitude: -86.27,
  capacityTonDay: 3,
  currentLoadPercent: 40,
  status: "available",
  ...overrides,
});

const ORIGIN = { latitude: 12.136, longitude: -86.271 };

Deno.test("Haversine: distancia simétrica y caso trivial en el mismo punto", () => {
  const a = { latitude: 12.136, longitude: -86.271 };
  const b = LANDFILL;

  assertAlmostEquals(haversineKm(a, b), haversineKm(b, a), 1e-9, "simétrica: ida = vuelta");
  assertEquals(haversineKm(a, a), 0);
  assert(haversineKm(a, b) > 1, "La Chureca queda a varios km del origen");
});

Deno.test("Peso estimado: volumen × densidad aparente de rama (120 kg/m³)", () => {
  assertEquals(estimatedWeightKg(0.8), 0.8 * BIOMASS_DENSITY_KG_PER_M3);
  assertEquals(estimatedWeightKg(2.5), 300);
});

Deno.test("Carga entrante y estados de tolva siguen los umbrales", () => {
  assertEquals(incomingLoadPercent(3000, 3), 100, "3 t sobre capacidad diaria de 3 t");
  assertEquals(incomingLoadPercent(1, 0), 100, "capacidad cero nunca se satura en negativo");

  assertEquals(nodeStatusFromLoad(HOPPER.busyThresholdPercent - 1), "available");
  assertEquals(nodeStatusFromLoad(HOPPER.busyThresholdPercent), "busy");
  assertEquals(nodeStatusFromLoad(HOPPER.fullThresholdPercent), "full");
});

Deno.test("Recomendación: descarta saturados, premia al más cercano y ahorra diésel", () => {
  const nodes = [
    node({ id: "cercano", latitude: 12.1328, longitude: -86.2764, currentLoadPercent: 45 }),
    node({ id: "lejano", latitude: 12.2, longitude: -86.35, currentLoadPercent: 30 }),
    node({
      id: "lleno",
      latitude: 12.13,
      longitude: -86.27,
      currentLoadPercent: 95,
      status: "full",
    }),
  ];

  const result = recommendNode(nodes, ORIGIN, 0.8, false);

  assertEquals(result.recommended?.node.id, "cercano", "gana el cercano con holgura");
  assertEquals(result.fallbackApplied, false);
  assert(result.rejected.some((r) => r.nodeId === "lleno"), "la tolva ≥90% se rechaza");
  assert(result.candidates.some((c) => c.nodeId === "cercano" && c.eligible));

  // El ahorro se mide contra el vertedero, que está más lejos que el nodo.
  assert(result.recommended!.fuelSavedUsd > 0);
  assert(
    result.recommended!.landfillDistanceKm > result.recommended!.distanceKm,
    "La Chureca debe quedar más lejos que el nodo recomendado",
  );
  assert(result.recommended!.projectedLoadPercent <= 100);
});

Deno.test("Recomendación: si todo está saturado aplica el fallback documentado", () => {
  const nodes = [
    node({ id: "a", currentLoadPercent: 99, status: "full" }),
    node({ id: "b", currentLoadPercent: 92, status: "full" }),
  ];

  const result = recommendNode(nodes, ORIGIN, 5, true);

  assert(result.fallbackApplied, "debe avisar que no hay capacidad real");
  assertEquals(result.recommended?.node.id, "b", "sugiere el menos cargado (92% < 99%)");
  assert(result.recommended!.reason.includes("Ningún Bio-Nodo tiene capacidad"));
  assertEquals(result.rejected.length, 2);

  // Camión municipal: litios por km más altos que el vehículo liviano.
  const liviano = recommendNode(nodes, ORIGIN, 5, false);
  assert(
    liviano.recommended!.fuelSavedLiters < result.recommended!.fuelSavedLiters,
    "el camión municipal consume más L/km que el vehículo liviano",
  );
});

Deno.test("Recomendación: lote que desborda la tolva proyectada se descarta", () => {
  const nodes = [
    node({
      id: "chico",
      currentLoadPercent: 85,
      capacityTonDay: 3,
      latitude: 12.133,
      longitude: -86.276,
    }),
    node({
      id: "amplio",
      currentLoadPercent: 40,
      capacityTonDay: 5,
      latitude: 12.14,
      longitude: -86.28,
    }),
  ];

  const result = recommendNode(nodes, ORIGIN, 5, true); // 600 kg → +20 pts sobre 3 t/día

  assertEquals(result.recommended?.node.id, "amplio");
  assert(
    result.rejected.some((r) => r.nodeId === "chico" && r.reason.includes("no cabe")),
    `esperaba rechazo por carga proyectada, vino: ${JSON.stringify(result.rejected)}`,
  );
});
