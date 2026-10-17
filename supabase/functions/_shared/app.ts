import { createRepository } from "./data/factory.ts";
import type { BioRedRepo } from "./data/repo.ts";
import { createRouter } from "./routes/router.ts";
import { apiRoutes } from "./routes/api.routes.ts";

/**
 * Composición de la aplicación (misma instancia para local y para el edge).
 * Clean Architecture: la entrada (servidor o Edge Function) solo hace `app.fetch(req)`.
 */
export function createApp(repo: BioRedRepo = createRepository()) {
  const router = createRouter(apiRoutes(repo), repo);

  return {
    repo,
    fetch: (request: Request): Promise<Response> => router(request),
  };
}

export type BioRedApp = ReturnType<typeof createApp>;
