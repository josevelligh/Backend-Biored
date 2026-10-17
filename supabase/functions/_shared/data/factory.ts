import { env } from "../config/env.ts";
import { MemoryRepo } from "./memory.repo.ts";
import { PostgresRepo } from "./postgres.repo.ts";
import type { BioRedRepo } from "./repo.ts";

/**
 * Fábrica del adaptador de persistencia.
 *
 * Con `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` → Postgres (producción/APK).
 * Sin credenciales → repositorio en memoria con los datos semilla de Managua,
 * para que `npm run dev` y las demos en vivo funcionen al instante.
 */
export function createRepository(): BioRedRepo {
  if (env.hasSupabase) {
    console.log("[biored] repositorio: Supabase Postgres");
    return new PostgresRepo(env.supabaseUrl, env.supabaseServiceRoleKey);
  }

  console.log(
    "[biored] repositorio: MEMORIA (modo demo). Configura SUPABASE_URL y " +
      "SUPABASE_SERVICE_ROLE_KEY en .env para usar Postgres.",
  );
  return new MemoryRepo();
}
