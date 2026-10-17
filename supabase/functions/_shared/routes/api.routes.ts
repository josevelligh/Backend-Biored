import { API, ECONOMICS, LANDFILL, SIZE_CATEGORIES, UCT3 } from "../config/constants.ts";
import type { BioRedRepo } from "../data/repo.ts";
import { json } from "../middlewares/errorHandler.ts";
import { communityController } from "../controllers/community.controller.ts";
import { marketplaceController } from "../controllers/marketplace.controller.ts";
import { nodesController } from "../controllers/nodes.controller.ts";
import { pruningController } from "../controllers/pruning.controller.ts";
import { telemetryController } from "../controllers/telemetry.controller.ts";
import { usersController } from "../controllers/users.controller.ts";
import type { RouteContext, RouteDefinition, RouteHandler } from "./router.ts";

/**
 * Tabla de rutas de la API `/api/v1`.
 * Las rutas estáticas van antes que las dinámicas (`:id`).
 */
export function apiRoutes(repo: BioRedRepo): RouteDefinition[] {
  const nodes = nodesController(repo);
  const pruning = pruningController(repo);
  const marketplace = marketplaceController(repo);
  const community = communityController(repo);
  const telemetry = telemetryController(repo);
  const users = usersController(repo);

  const route = (method: string, path: string, handler: RouteHandler): RouteDefinition => ({
    method,
    path,
    handler,
  });

  return [
    route("GET", "", index),
    route("GET", "health", health),

    // Bio-Nodos y enrutamiento inteligente
    route("GET", "nodes", nodes.list),
    route("GET", "nodes/impact/network", nodes.networkImpact),
    route("POST", "nodes/recommend", nodes.recommend),
    route("GET", "nodes/:id", nodes.getOne),
    route("GET", "nodes/:id/batches", nodes.batches),
    route("POST", "nodes/:id/process-batch", nodes.processBatch),

    // Registro de poda y escaneo QR
    route("GET", "pruning/tickets", pruning.listTickets),
    route("POST", "pruning/tickets", pruning.createTicket),
    route("POST", "pruning/verify-qr", pruning.verifyQr),

    // Trueque verde / viveros
    route("GET", "marketplace/items", marketplace.listItems),
    route("GET", "marketplace/items/:id", marketplace.getItem),
    route("GET", "marketplace/redemptions", marketplace.redemptions),
    route("POST", "marketplace/redeem", marketplace.redeem),

    // Feed comunitario y retos
    route("GET", "community/feed", community.feed),
    route("GET", "community/posts/:id", community.getPost),
    route("POST", "community/posts", community.createPost),
    route("POST", "community/posts/:id/like", community.like),
    route("POST", "community/challenges", community.createChallenge),

    // Telemetría municipal
    route("GET", "telemetry/summary", telemetry.summary),
    route("GET", "telemetry/districts", telemetry.districts),
    route("GET", "telemetry/nodes", telemetry.nodes),

    // Vecinos / billetera
    route("GET", "users", users.list),
    route("GET", "users/:id", users.getOne),
    route("GET", "users/:id/wallet", users.wallet),
  ];
}

/** `GET /api/v1` — índice navegable de la API (útil para el pitch y para Postman). */
const index = (): Response =>
  json({
    name: "BioRed API",
    version: API.version,
    description:
      "Motor logístico y de telemetría de los Bio-Nodos Barriales de Managua (Desafío 04).",
    endpoints: {
      nodes: [
        "GET  /nodes",
        "GET  /nodes/:id",
        "GET  /nodes/:id/batches",
        "GET  /nodes/impact/network",
        "POST /nodes/recommend",
        "POST /nodes/:id/process-batch",
      ],
      pruning: [
        "GET  /pruning/tickets?userId=",
        "POST /pruning/tickets",
        "POST /pruning/verify-qr",
      ],
      marketplace: [
        "GET  /marketplace/items",
        "GET  /marketplace/items/:id",
        "GET  /marketplace/redemptions?userId=",
        "POST /marketplace/redeem",
      ],
      community: [
        "GET  /community/feed",
        "GET  /community/posts/:id",
        "POST /community/posts",
        "POST /community/posts/:id/like",
        "POST /community/challenges",
      ],
      telemetry: ["GET /telemetry/summary", "GET /telemetry/districts", "GET /telemetry/nodes"],
      users: ["GET /users", "GET /users/:id", "GET /users/:id/wallet"],
    },
    domain: {
      sizeCategories: SIZE_CATEGORIES,
      uct3: {
        baseFractions: UCT3.baseFractions,
        referenceMoisturePercent: UCT3.referenceMoisturePercent,
        bioPotsPerTonMedium: UCT3.bioPotsPerTonMedium,
        compostCycleDays: UCT3.compostCycleDays,
      },
      landfill: LANDFILL,
      economics: ECONOMICS,
    },
  });

const health = async (ctx: RouteContext): Promise<Response> => {
  const started = performance.now();
  const nodes = await ctx.repo.listNodes();
  return json({
    status: "ok",
    mode: ctx.repo.mode,
    nodesRegistered: nodes.length,
    latencyMs: Math.round(performance.now() - started),
    timestamp: new Date().toISOString(),
  });
};
