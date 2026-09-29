/** Respuesta genérica de las acciones sin payload (`{ ok: true }`). */
export interface OkResponse {
  ok: true;
}

/** Query de paginación por cursor opaco (enviar `nextCursor` tal cual, sin interpretarlo). */
export interface CursorPageQuery {
  cursor?: string | null;
  limit?: number;
}

/** Error semántico del backend (`{ error: "code", ...extra }`). */
export interface ApiErrorResponse {
  error: string;
  [key: string]: unknown;
}

/** Errores de validación de changeset (`{ errors: { field: ["msg"] } }`). */
export interface ValidationErrorResponse {
  errors: Record<string, string[]>;
}

/** Códigos de error de paginación compartidos por feed, likes y mensajes (HTTP 422). */
export type PaginationErrorCode = "invalid_cursor" | "invalid_limit";
