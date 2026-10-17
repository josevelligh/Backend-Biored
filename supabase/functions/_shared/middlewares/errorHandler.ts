import { AppError } from "../lib/errors.ts";

/** Cabeceras CORS abiertas: la app Expo (nativo y web) consume la API desde LAN y desde el edge. */
export function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, apikey, x-client-info, content-type, accept, x-request-id",
    "Access-Control-Max-Age": "86400",
  };
}

export function json(
  data: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...corsHeaders(),
      ...extraHeaders,
    },
  });
}

export function noContent(): Response {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export function preflight(): Response {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

/**
 * Respuesta de error estandarizada:
 * `{ "error": { "code", "message", "details?" } }`
 */
export function errorResponse(error: unknown): Response {
  if (error instanceof AppError) {
    return json(
      { error: { code: error.code, message: error.message, details: error.details ?? undefined } },
      error.status,
    );
  }

  const message = error instanceof Error ? error.message : "Error inesperado";
  console.error("[biored] unhandled error:", error);
  return json(
    { error: { code: "INTERNAL_ERROR", message: "Error interno del servidor", details: message } },
    500,
  );
}
