import type { ErrorCode } from "../../domain/errors/types";

/**
 * Maps a domain error code to an HTTP status code.
 *
 * This mapping lives in the presentation layer so the domain stays unaware
 * of the transport protocol.
 */
const HTTP_STATUS_BY_CODE: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION_ERROR: 422,
  RATE_LIMITED: 429,
  INTERNAL_SERVER_ERROR: 500,
};

export function httpStatusForErrorCode(code: ErrorCode): number {
  return HTTP_STATUS_BY_CODE[code] ?? 500;
}
