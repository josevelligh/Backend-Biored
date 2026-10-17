import { ECONOMICS, FUEL, IMPACT, UCT3 } from "../config/constants.ts";
import { computeRoi } from "./uct3.service.ts";
import type {
  BatchRecord,
  BioNodeRecord,
  PruningTicketRecord,
  TelemetrySummary,
  UserRecord,
} from "../data/types.ts";

const round = (value: number, decimals = 2): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

export interface TelemetryInput {
  batches: BatchRecord[];
  nodes: BioNodeRecord[];
  users: UserRecord[];
  tickets: PruningTicketRecord[];
}

/**
 * Consolida el panel municipal en tiempo real.
 *
 * Se calcula en TypeScript (y no en SQL) para que el modo demo y Postgres
 * cuenten exactamente la misma historia con una sola fórmula.
 */
export function computeTelemetry(input: TelemetryInput, now: Date = new Date()): TelemetrySummary {
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const inWindow = (batch: BatchRecord, from: Date): boolean =>
    new Date(batch.createdAt).getTime() >= from.getTime();

  const weekBatches = input.batches.filter((batch) => inWindow(batch, weekAgo));
  const monthBatches = input.batches.filter((batch) => inWindow(batch, monthAgo));

  const sum = (list: BatchRecord[], pick: (batch: BatchRecord) => number): number =>
    round(list.reduce((acc, batch) => acc + pick(batch), 0), 2);

  const tonsWeek = sum(weekBatches, (b) => b.tonsProcessed);
  const tonsMonth = sum(monthBatches, (b) => b.tonsProcessed);
  const potsMonth = Math.round(sum(monthBatches, (b) => b.bioPots));

  const monthTickets = input.tickets.filter(
    (ticket) =>
      ticket.status === "VERIFIED" &&
      ticket.verifiedAt !== null &&
      new Date(ticket.verifiedAt).getTime() >= monthAgo.getTime(),
  );

  const verifiedKgMonth = monthTickets.reduce((acc, ticket) => acc + ticket.estimatedWeightKg, 0);
  const tonsFromTickets = verifiedKgMonth / 1000;
  const measurableTonsMonth = tonsMonth > 0 ? tonsMonth : round(tonsFromTickets, 2);

  const activeNodes = input.nodes.filter((node) => node.status !== "full").length;
  const avgLoadPercent = input.nodes.length > 0
    ? round(
      input.nodes.reduce((acc, node) => acc + node.currentLoadPercent, 0) / input.nodes.length,
      1,
    )
    : 0;

  const citizens = input.users.filter((user) => user.role === "CITIZEN" || user.role === "BRIGADE");
  const co2AvoidedKg = round(
    (measurableTonsMonth * 1000 + verifiedKgMonth) * IMPACT.co2AvoidedKgPerKg,
    2,
  );

  const fuelSavingsUsdWeek = round(
    tonsWeek * FUEL.litersSavedPerTonBiomass * FUEL.dieselUsdPerLiter,
    2,
  );

  const roi = computeRoi(ECONOMICS.monthlyReturnUsd, ECONOMICS.capexUsd);

  return {
    totalTonsProcessedWeek: tonsWeek,
    totalTonsProcessedMonth: measurableTonsMonth,
    trucksSavedMonth: round(measurableTonsMonth / FUEL.compactionRatio, 1),
    bioPotsProducedMonth: potsMonth,
    mulchProducedKgMonth: sum(monthBatches, (b) => b.coarseMulchKg),
    compostProducedKgMonth: sum(monthBatches, (b) => b.fineCompostKg),
    parkSoilTempReductionC: UCT3.mulchTempReductionC,
    waterSavingsPercent: UCT3.mulchWaterSavingsPercent,
    monthlyFinancialReturnUsd: roi.monthlyReturnUsd,
    capexUsd: roi.capexUsd,
    monthlyPaybackMonths: roi.monthlyPaybackMonths,
    co2AvoidedKg,
    activeNodes,
    totalNodes: input.nodes.length,
    avgLoadPercent,
    citizensCount: citizens.length,
    ticketsVerifiedMonth: monthTickets.length,
    fuelSavingsUsdWeek,
  };
}
