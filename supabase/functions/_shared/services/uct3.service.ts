import { UCT3 } from "../config/constants.ts";

/**
 * Motor físico de conversión tricapa de la máquina UCT-3.
 *
 * La biomasa entra a un cilindro *Trommel* que la separa en tres fracciones.
 * La humedad de la época (invierno nicaragüense vs. verano) cambia el resultado:
 * con material húmedo el tamiz se engrasa/aglomera, por lo que la fracción gruesa
 * crece y la fina (compost) se reduce.
 *
 * Modelo documentado:
 *   deviation = humedad − 30                       (30% = humedad de referencia)
 *   grueso    = clamp(0.50 + deviation × 0.004)
 *   fino      = clamp(0.35 − deviation × 0.006)
 *   medio     = 1 − grueso − fino                  (normalizado para sumar 100%)
 */

export interface TripleLayerResult {
  input: { tonsProcessed: number; moisturePercent: number };
  /** Fracciones normalizadas (suman 1). */
  fractions: { coarseM25: number; fineM8: number; medium8to25: number };
  /** Salidas físicas. */
  coarseMulchKg: number;
  fineCompostKg: number;
  mediumFiberKg: number;
  bioPots: number;
  bladeHoursUsed: number;
  bladeAlert: boolean;
  /** Impacto agronómico del mulch. */
  mulchCoverageM2: number;
  soilTempReductionC: number;
  waterSavingsPercent: number;
  compostReadyAt: string;
  compostCycleDays: number;
  /** Valor comercial estimado del lote (USD). */
  estimatedValueUsd: number;
  valueBreakdownUsd: { mulch: number; compost: number; bioPots: number };
  /** true cuando la humedad obliga a secado previo. */
  needsPreDrying: boolean;
  notes: string[];
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const round = (value: number, decimals = 2): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

export function computeTripleLayer(
  tonsProcessed: number,
  moisturePercent: number,
  now: Date = new Date(),
): TripleLayerResult {
  const tons = clamp(tonsProcessed, 0, 5000);
  const moisture = clamp(moisturePercent, 0, 100);
  const deviation = moisture - UCT3.referenceMoisturePercent;

  const coarseRaw = UCT3.baseFractions.coarseM25 + deviation * UCT3.coarseMoistureSensitivity;
  const fineRaw = UCT3.baseFractions.fineM8 - deviation * UCT3.fineMoistureSensitivity;

  const coarseM25 = clamp(coarseRaw, UCT3.coarseRange[0], UCT3.coarseRange[1]);
  const fineM8 = clamp(fineRaw, UCT3.fineRange[0], UCT3.fineRange[1]);
  const mediumRaw = 1 - coarseM25 - fineM8;
  const medium8to25 = clamp(mediumRaw, UCT3.mediumRange[0], UCT3.mediumRange[1]);

  // Normalización para que las tres fracciones sumen exactamente 100%.
  const total = coarseM25 + fineM8 + medium8to25;
  const fractions = {
    coarseM25: round(coarseM25 / total, 4),
    fineM8: round(fineM8 / total, 4),
    medium8to25: round(medium8to25 / total, 4),
  };

  const inputKg = tons * 1000;
  const coarseMulchKg = round(inputKg * fractions.coarseM25, 2);
  const fineCompostKg = round(inputKg * fractions.fineM8, 2);
  const mediumFiberKg = round(inputKg * fractions.medium8to25, 2);

  const mediumTons = mediumFiberKg / 1000;
  const bioPots = Math.round(mediumTons * UCT3.bioPotsPerTonMedium);

  const bladeHoursUsed = round(tons * UCT3.bladeHoursPerTon, 2);

  const mulchTons = coarseMulchKg / 1000;
  const compostTons = fineCompostKg / 1000;
  const valueBreakdownUsd = {
    mulch: round(mulchTons * UCT3.mulchUsdPerTon, 2),
    compost: round(compostTons * UCT3.compostUsdPerTon, 2),
    bioPots: round(bioPots * UCT3.bioPotUsd, 2),
  };

  const compostReadyAt = new Date(
    now.getTime() + UCT3.compostCycleDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  const needsPreDrying = moisture > 45;
  const notes: string[] = [];

  if (deviation > 0) {
    notes.push(
      `Época húmeda (${
        round(moisture, 1)
      }%): el trommel entrega más fracción gruesa y menos compost.`,
    );
  } else if (deviation < 0) {
    notes.push(
      `Material seco (${
        round(moisture, 1)
      }%): mejora el rendimiento de compost fino y fibra media.`,
    );
  } else {
    notes.push("Humedad óptima de referencia (30%): distribución base de la UCT-3.");
  }

  if (needsPreDrying) {
    notes.push("Humedad > 45%: programar 24 h de secado en andén antes de prensar Bio-Macetas.");
  }

  if (bladeHoursUsed > 0) {
    notes.push(
      `Cuchillas Acero 5160: +${bladeHoursUsed} h en este lote (alerta a las ${UCT3.bladeAlertHours} h).`,
    );
  }

  return {
    input: { tonsProcessed: round(tons, 3), moisturePercent: round(moisture, 1) },
    fractions,
    coarseMulchKg,
    fineCompostKg,
    mediumFiberKg,
    bioPots,
    bladeHoursUsed,
    bladeAlert: bladeHoursUsed >= UCT3.bladeAlertHours,
    mulchCoverageM2: round(mulchTons * UCT3.mulchCoverageM2PerTon, 1),
    soilTempReductionC: UCT3.mulchTempReductionC,
    waterSavingsPercent: UCT3.mulchWaterSavingsPercent,
    compostReadyAt,
    compostCycleDays: UCT3.compostCycleDays,
    estimatedValueUsd: round(
      valueBreakdownUsd.mulch + valueBreakdownUsd.compost + valueBreakdownUsd.bioPots,
      2,
    ),
    valueBreakdownUsd,
    needsPreDrying,
    notes,
  };
}

/** ROI del sistema completo, usado por la telemetría municipal. */
export function computeRoi(monthlyReturnUsd: number, capexUsd: number): {
  monthlyReturnUsd: number;
  capexUsd: number;
  monthlyPaybackMonths: number;
  annualReturnUsd: number;
} {
  const monthlyPaybackMonths = monthlyReturnUsd > 0 ? round(capexUsd / monthlyReturnUsd, 2) : 0;
  return {
    monthlyReturnUsd,
    capexUsd,
    monthlyPaybackMonths,
    annualReturnUsd: round(monthlyReturnUsd * 12, 2),
  };
}
