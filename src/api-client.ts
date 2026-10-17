/**
 * Cliente tipado de la BioRed API para la app Expo.
 *
 * Copia este archivo dentro de tu app (p. ej. `RallyApp/services/api-client.ts`)
 * y define en `.env`:
 *
 *   EXPO_PUBLIC_BIORED_API_URL=http://<IP-LAN>:3000/api/v1
 *   # o en producción:
 *   EXPO_PUBLIC_BIORED_API_URL=https://<ref>.supabase.co/functions/v1/api/api/v1
 *
 * La app (Expo) ya lo consume en `services/biored.ts` con respaldo a los mocks
 * locales cuando la API no responde.
 */

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export class BioRedError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "BioRedError";
  }
}

export interface BioRedClientOptions {
  /** URL base que incluye `/api/v1`. */
  baseUrl: string;
  /** anon key de Supabase (opcional en local; recomendada en la Edge Function). */
  anonKey?: string;
  timeoutMs?: number;
}

export class BioRedClient {
  private readonly baseUrl: string;
  private readonly anonKey?: string;
  private readonly timeoutMs: number;

  constructor({ baseUrl, anonKey, timeoutMs = 10_000 }: BioRedClientOptions) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.anonKey = anonKey;
    this.timeoutMs = timeoutMs;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          ...(this.anonKey ? { authorization: `Bearer ${this.anonKey}` } : {}),
          ...(init.headers ?? {}),
        },
      });
      const text = await response.text();
      const body = text ? JSON.parse(text) : null;
      if (!response.ok) {
        const apiError = (body as ApiErrorBody | null)?.error;
        throw new BioRedError(
          response.status,
          apiError?.code ?? "HTTP_ERROR",
          apiError?.message ?? response.statusText,
          apiError?.details,
        );
      }
      return body as T;
    } finally {
      clearTimeout(timer);
    }
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>(path);
  }

  post<T>(path: string, payload?: unknown): Promise<T> {
    return this.request<T>(path, { method: "POST", body: JSON.stringify(payload ?? {}) });
  }

  // --- Atajos de los endpoints principales --------------------------------
  health() {
    return this.get<{ status: string; mode: "memory" | "postgres"; nodesRegistered: number }>(
      "/health",
    );
  }

  nodes() {
    return this.get<{ nodes: unknown[]; summary: unknown }>("/nodes");
  }

  recommend(
    input: { latitude: number; longitude: number; volumeM3?: number; isMunicipalTruck?: boolean },
  ) {
    return this.post<{ recommended: unknown | null; summary: string }>("/nodes/recommend", input);
  }

  createTicket(input: {
    userId: string;
    sizeCategory: "sm" | "md" | "lg";
    assignedNodeId?: string;
    latitude?: number;
    longitude?: number;
  }) {
    return this.post<{ ticket: unknown }>("/pruning/tickets", input);
  }

  verifyQr(input: { qrCodeHash: string; operatorId: string }) {
    return this.post<{ message: string; ticket: unknown }>("/pruning/verify-qr", input);
  }

  feed() {
    return this.get<{ feed: unknown[]; challenges: unknown[]; stats: unknown }>("/community/feed");
  }

  items() {
    return this.get<{ items: unknown[]; count: number }>("/marketplace/items");
  }

  redeem(input: { userId: string; itemId: string }) {
    return this.post<{ message: string; receipt: unknown }>("/marketplace/redeem", input);
  }

  wallet(userId: string) {
    return this.get<{ user: unknown; tickets: unknown[]; redemptions: unknown[] }>(
      `/users/${userId}/wallet`,
    );
  }

  telemetry() {
    return this.get<Record<string, unknown>>("/telemetry/summary");
  }
}
