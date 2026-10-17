import { API } from "../config/constants.ts";
import type { BioRedRepo } from "../data/repo.ts";
import { errorResponse, json, preflight } from "../middlewares/errorHandler.ts";

export interface RouteContext {
  request: Request;
  url: URL;
  /** Puerto de persistencia inyectado. */
  repo: BioRedRepo;
  /** Parámetros de ruta (`/nodes/:id`). */
  params: Record<string, string>;
  /** Query string ya parseada. */
  query: URLSearchParams;
  body: () => Promise<unknown>;
}

export type RouteHandler = (ctx: RouteContext) => Promise<Response> | Response;

export interface RouteDefinition {
  method: string;
  /** Ruta relativa a `/api/v1`, con `:param` para segmentos dinámicos. */
  path: string;
  handler: RouteHandler;
}

interface CompiledRoute extends RouteDefinition {
  segments: string[];
}

function compile(routes: RouteDefinition[]): CompiledRoute[] {
  return routes.map((route) => ({
    ...route,
    segments: route.path.split("/").filter(Boolean),
  }));
}

/**
 * Router mínimo sobre Web Standard `Request`/`Response`.
 *
 * Ventaja: el mismo objeto `app` corre en `Deno.serve` local y dentro de la
 * Supabase Edge Function, sin Express ni frameworks de por medio.
 */
export function createRouter(routes: RouteDefinition[], repo: BioRedRepo) {
  const compiled = compile(routes);

  return async function handle(request: Request): Promise<Response> {
    try {
      if (request.method === "OPTIONS") return preflight();

      const url = new URL(request.url);
      const path = normalizePath(url.pathname);
      const segments = path.split("/").filter(Boolean);

      for (const route of compiled) {
        if (route.method !== request.method) continue;

        const params = matchSegments(route.segments, segments);
        if (!params) continue;

        const ctx: RouteContext = {
          request,
          url,
          repo,
          params,
          query: url.searchParams,
          body: async () => {
            const text = await request.text();
            if (!text) return {};
            try {
              return JSON.parse(text);
            } catch {
              return { __invalidJson: text };
            }
          },
        };

        return await route.handler(ctx);
      }

      return json(
        {
          error: {
            code: "NOT_FOUND",
            message: `Ruta no encontrada: ${request.method} ${url.pathname}`,
            hint: `Revisa el índice de la API en GET ${API.basePath}`,
          },
        },
        404,
      );
    } catch (error) {
      return errorResponse(error);
    }
  };
}

/**
 * Deja la ruta en la forma `/nodes/:id` sin importar cómo llegue:
 *  - local:      http://localhost:3000/api/v1/nodes
 *  - edge:       https://<ref>.supabase.co/functions/v1/api/api/v1/nodes
 *  - edge raíz:  https://<ref>.supabase.co/functions/v1/api/nodes
 */
function normalizePath(pathname: string): string {
  const marker = API.basePath; // '/api/v1'
  const index = pathname.indexOf(marker);

  if (index >= 0) return pathname.slice(index + marker.length);

  const functionMarker = "/functions/v1/";
  const fnIndex = pathname.indexOf(functionMarker);
  if (fnIndex >= 0) {
    const afterFunction = pathname.slice(fnIndex + functionMarker.length); // 'api/nodes'
    const slash = afterFunction.indexOf("/");
    return slash >= 0 ? afterFunction.slice(slash) : "";
  }

  return pathname;
}

function matchSegments(
  routeSegments: string[],
  actualSegments: string[],
): Record<string, string> | null {
  if (routeSegments.length !== actualSegments.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < routeSegments.length; i += 1) {
    const routeSegment = routeSegments[i];
    const actualSegment = actualSegments[i];

    if (routeSegment.startsWith(":")) {
      params[routeSegment.slice(1)] = decodeURIComponent(actualSegment);
      continue;
    }
    if (routeSegment !== actualSegment) return null;
  }
  return params;
}
