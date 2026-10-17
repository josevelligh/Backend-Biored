/** Error de dominio con código estable para el cliente móvil. */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (code: string, message: string, details?: unknown): AppError =>
  new AppError(400, code, message, details);

export const notFound = (code: string, message: string): AppError =>
  new AppError(404, code, message);

export const conflict = (code: string, message: string, details?: unknown): AppError =>
  new AppError(409, code, message, details);

export const unprocessable = (code: string, message: string, details?: unknown): AppError =>
  new AppError(422, code, message, details);

/** Códigos de negocio que pueden elevar las funciones RPC de Postgres. */
export type DomainErrorCode =
  | "TICKET_NOT_FOUND"
  | "TICKET_ALREADY_VERIFIED"
  | "TICKET_CANCELLED"
  | "NODE_NOT_FOUND"
  | "USER_NOT_FOUND"
  | "ITEM_NOT_FOUND"
  | "OUT_OF_STOCK"
  | "INSUFFICIENT_POINTS"
  | "OPERATOR_NOT_FOUND";
