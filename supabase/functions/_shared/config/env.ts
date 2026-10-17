import type { RepositoryMode } from "../data/types.ts";

/**
 * Lectura centralizada del entorno. Funciona igual en:
 *  - `npm run dev`  (Deno + --env-file=.env)
 *  - Supabase Edge Functions (secrets inyectados por la plataforma)
 */
export interface Env {
  port: number;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  /** true cuando hay credenciales válidas de Supabase. */
  hasSupabase: boolean;
  mode: RepositoryMode;
}

function read(name: string): string {
  return (Deno.env.get(name) ?? "").trim();
}

export function loadEnv(): Env {
  const supabaseUrl = read("SUPABASE_URL");
  const supabaseServiceRoleKey = read("SUPABASE_SERVICE_ROLE_KEY");
  const hasSupabase = supabaseUrl.length > 0 && supabaseServiceRoleKey.length > 0;
  const port = Number(read("PORT") || 3000);

  return {
    port: Number.isFinite(port) && port > 0 ? port : 3000,
    supabaseUrl,
    supabaseServiceRoleKey,
    hasSupabase,
    mode: hasSupabase ? "postgres" : "memory",
  };
}

export const env = loadEnv();
