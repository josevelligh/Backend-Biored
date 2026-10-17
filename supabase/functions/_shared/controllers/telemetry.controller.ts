import type { BioRedRepo } from "../data/repo.ts";
import { computeTelemetry } from "../services/telemetry.service.ts";
import { serializeNode, serializeTelemetry } from "../serializers/dto.ts";
import { json } from "../middlewares/errorHandler.ts";

/**
 * Telemetría municipal: el consolidado que ve la Alcaldía en tiempo real.
 */
export function telemetryController(repo: BioRedRepo) {
  async function snapshot() {
    const [batches, nodes, users, tickets] = await Promise.all([
      repo.listBatches(),
      repo.listNodes(),
      repo.listUsers(),
      repo.listTickets(),
    ]);
    return { batches, nodes, users, tickets };
  }

  return {
    /** `GET /telemetry/summary` */
    async summary(): Promise<Response> {
      const data = await snapshot();
      const telemetry = computeTelemetry(data);

      return json({
        ...serializeTelemetry(telemetry),
        mode: repo.mode,
        network: {
          nodes: data.nodes.map((node) => ({
            id: node.id,
            name: node.name,
            district: node.district,
            status: node.status,
            currentLoadPercent: node.currentLoadPercent,
            bladeHoursUsed: node.bladeHoursUsed,
            bladeAlert: node.bladeHoursUsed >= 40,
          })),
        },
      });
    },

    /** `GET /telemetry/districts` — avance de metas por distrito (Retos Barriales). */
    async districts(): Promise<Response> {
      const [nodes, batches, tickets] = await Promise.all([
        repo.listNodes(),
        repo.listBatches(),
        repo.listTickets(),
      ]);

      const nodeById = new Map(nodes.map((node) => [node.id, node]));
      const districts = new Map<
        string,
        {
          district: string;
          nodes: number;
          tonsProcessed: number;
          verifiedTickets: number;
          kgDelivered: number;
          loadPercentSum: number;
        }
      >();

      for (const node of nodes) {
        const entry = districts.get(node.district) ?? {
          district: node.district,
          nodes: 0,
          tonsProcessed: 0,
          verifiedTickets: 0,
          kgDelivered: 0,
          loadPercentSum: 0,
        };
        entry.nodes += 1;
        entry.loadPercentSum += node.currentLoadPercent;
        districts.set(node.district, entry);
      }

      for (const batch of batches) {
        const district = nodeById.get(batch.nodeId)?.district;
        if (!district) continue;
        const entry = districts.get(district);
        if (entry) entry.tonsProcessed = round(entry.tonsProcessed + batch.tonsProcessed, 2);
      }

      for (const ticket of tickets) {
        if (ticket.status !== "VERIFIED") continue;
        const district = nodeById.get(ticket.assignedNodeId)?.district;
        if (!district) continue;
        const entry = districts.get(district);
        if (entry) {
          entry.verifiedTickets += 1;
          entry.kgDelivered = round(entry.kgDelivered + ticket.estimatedWeightKg, 2);
        }
      }

      const list = [...districts.values()].map((entry) => ({
        ...entry,
        avgLoadPercent: entry.nodes > 0 ? round(entry.loadPercentSum / entry.nodes, 1) : 0,
        loadPercentSum: undefined,
      }));

      return json({
        count: list.length,
        districts: list.sort((a, b) => b.tonsProcessed - a.tonsProcessed),
      });
    },

    /** `GET /telemetry/nodes` — estado crudo de tolvas y stock. */
    async nodes(): Promise<Response> {
      const nodes = await repo.listNodes();
      return json({ nodes: nodes.map(serializeNode) });
    },
  };
}

const round = (value: number, decimals = 2): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};
