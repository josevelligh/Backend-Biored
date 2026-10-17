import { SIZE_CATEGORIES, type SizeCategory } from "../config/constants.ts";

/**
 * Vales QR del programa "Rama por Planta".
 *
 * Flujo:
 *  1. El vecino registra su poda → se crea un `PruningTicket` en estado PENDING
 *     con un token QR único (hash) + un código legible para el operario.
 *  2. El operario escanea el QR en el Bio-Nodo → `verify-qr` lo pasa a VERIFIED
 *     y liquida los Eco-Puntos en una transacción atómica.
 *
 * El hash es SHA-256 de `código + entropía`, así el token que viaja en el QR no
 * expone el identificador interno del ticket.
 */

export interface QrToken {
  /** Código legible para la UI y para el operario (ej. BIORED-MADRES-4821). */
  code: string;
  /** Hash SHA-256 único persistido en la base de datos. */
  qrCodeHash: string;
  /** Carga útil completa que se dibuja en el código QR. */
  qrPayload: string;
  pointsAwarded: number;
  volumeM3: number;
  assistantCode: string;
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin caracteres ambiguos (I, O, 0, 1)

function randomSegment(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("");
}

/** Deriva un "código de nodo" legible desde el nombre del Bio-Nodo. */
export function nodeCodeFromName(nodeName: string): string {
  const cleaned = nodeName
    .replace(/Bio-?Nodo/gi, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .trim()
    .toUpperCase();

  const words = cleaned.split(/\s+/).filter((w) => w.length > 2);
  const picked = words.slice(0, 2).map((w) => w.slice(0, 6));

  return (picked.join("-") || "NODO").slice(0, 14);
}

export async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function buildQrPayload(
  code: string,
  nodeCode: string,
  volumeM3: number,
  points: number,
): string {
  return `BIORED::VALE::${code}::${nodeCode}::${volumeM3}M3::${points}PTS`;
}

export async function createQrToken(
  nodeName: string,
  sizeCategory: SizeCategory,
  now: Date = new Date(),
): Promise<QrToken> {
  const { volumeM3, points } = SIZE_CATEGORIES[sizeCategory];
  const nodeCode = nodeCodeFromName(nodeName);
  const code = `BIORED-${nodeCode}-${randomSegment(4)}`;
  const entropy = `${code}|${now.toISOString()}|${randomSegment(24)}`;

  const qrCodeHash = await sha256Hex(entropy);
  const qrPayload = buildQrPayload(code, nodeCode, volumeM3, points);
  const assistantCode = `BR-${randomSegment(6)}`;

  return { code, qrCodeHash, qrPayload, pointsAwarded: points, volumeM3, assistantCode };
}

/**
 * Normaliza lo que llega desde el escáner: puede ser el hash, el código legible
 * o el payload completo del QR.
 */
export function normalizeScannedValue(raw: string): string {
  const value = raw.trim();
  if (value.startsWith("BIORED::VALE::")) {
    const parts = value.split("::");
    // BIORED::VALE::<code>::<node>::<vol>::<pts>
    return parts[2]?.trim() || value;
  }
  return value;
}

/** Recibo legible de un canje de Eco-Puntos. */
export function buildRedemptionCode(itemTitle: string): string {
  const prefix = itemTitle
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z]/g, "")
    .slice(0, 3)
    .toUpperCase()
    .padEnd(3, "X");
  return `CANJE-${prefix}-${randomSegment(5)}`;
}
