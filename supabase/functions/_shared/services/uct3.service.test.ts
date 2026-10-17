import { assert, assertAlmostEquals, assertEquals } from "jsr:@std/assert@1";
import { computeRoi, computeTripleLayer } from "./uct3.service.ts";
import { UCT3 } from "../config/constants.ts";

const sumFractions = (result: ReturnType<typeof computeTripleLayer>): number =>
  result.fractions.coarseM25 + result.fractions.fineM8 + result.fractions.medium8to25;

Deno.test("UCT-3: las tres fracciones suman 100% en cualquier humedad", () => {
  for (const moisture of [0, 15, 30, 42, 60, 100]) {
    const result = computeTripleLayer(2.5, moisture);
    assertAlmostEquals(sumFractions(result), 1, 1e-3, `humedad=${moisture}%`);
    assert(result.coarseMulchKg >= 0 && result.fineCompostKg >= 0 && result.mediumFiberKg >= 0);
  }
});

Deno.test("UCT-3: humedad de referencia (30%) entrega la distribución base documentada", () => {
  const result = computeTripleLayer(1, 30);
  assertAlmostEquals(result.fractions.coarseM25, UCT3.baseFractions.coarseM25, 1e-3);
  assertAlmostEquals(result.fractions.fineM8, UCT3.baseFractions.fineM8, 1e-3);
  assertAlmostEquals(result.fractions.medium8to25, UCT3.baseFractions.medium8to25, 1e-3);
});

Deno.test("UCT-3: más humedad = más mulch grueso y menos compost fino", () => {
  const dry = computeTripleLayer(2, 20);
  const wet = computeTripleLayer(2, 55);
  assert(wet.fractions.coarseM25 > dry.fractions.coarseM25);
  assert(wet.fractions.fineM8 < dry.fractions.fineM8);
  assert(wet.needsPreDrying, "humedad > 45% debe pedir secado previo");
  assert(!dry.needsPreDrying);
});

Deno.test("UCT-3: masas, Bio-Macetas y valor comercial cuadran con las constantes", () => {
  const result = computeTripleLayer(2.5, 30);
  const inputKg = 2500;
  assertAlmostEquals(
    result.coarseMulchKg + result.fineCompostKg + result.mediumFiberKg,
    inputKg,
    1,
  );

  const expectedBioPots = Math.round((result.mediumFiberKg / 1000) * UCT3.bioPotsPerTonMedium);
  assertEquals(result.bioPots, expectedBioPots);

  const expectedValue = Math.round(
    ((result.coarseMulchKg / 1000) * UCT3.mulchUsdPerTon +
      (result.fineCompostKg / 1000) * UCT3.compostUsdPerTon +
      result.bioPots * UCT3.bioPotUsd) * 100,
  ) / 100;
  assertAlmostEquals(result.estimatedValueUsd, expectedValue, 0.01);
  assertEquals(
    result.bladeHoursUsed,
    Math.round(2.5 * UCT3.bladeHoursPerTon * 100) / 100,
  );

  // Ciclo de compost de 28 días a partir del instante del lote.
  const now = new Date("2026-10-17T00:00:00.000Z");
  const expectedReady = new Date(now.getTime() + 28 * 24 * 60 * 60 * 1000).toISOString();
  assertEquals(computeTripleLayer(2.5, 30, now).compostReadyAt, expectedReady);
});

Deno.test("UCT-3: la alerta de cuchillas salta recién a las 40 h", () => {
  assert(!computeTripleLayer(20, 30).bladeAlert, "20 t × 0.35 h/t = 7 h < 40 h");
  // 120 t × 0.35 h/t = 42 h ≥ 40 h
  assert(computeTripleLayer(120, 30).bladeAlert);
});

Deno.test("ROI: payback ≈ CAPEX / retorno mensual documentado", () => {
  const roi = computeRoi(1140, 1200);
  assertEquals(roi.monthlyPaybackMonths, 1.05);
  assertEquals(roi.annualReturnUsd, 13680);
  assertEquals(computeRoi(0, 1200).monthlyPaybackMonths, 0, "sin retorno no hay payback");
});
