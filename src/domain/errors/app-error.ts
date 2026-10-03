import type { ErrorCode, IAppError } from "./types";

/**
 * Domain error.
 *
 * Carries a transport-agnostic {@link ErrorCode}. Mapping a code to an HTTP
 * status (or any other transport concern) is the responsibility of the
 * presentation layer - see `presentation/errors/http-status`.
 */
export class AppError extends Error implements IAppError {
  public readonly code: ErrorCode;
  public readonly details?: unknown;
  public readonly isAppError = true;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }

  static BadRequest(message: string, details?: unknown) {
    return new AppError("BAD_REQUEST", message, details);
  }

  static Unauthorized(message: string = "Unauthorized", details?: unknown) {
    return new AppError("UNAUTHORIZED", message, details);
  }

  static Forbidden(message: string = "Forbidden", details?: unknown) {
    return new AppError("FORBIDDEN", message, details);
  }

  static NotFound(message: string = "Not Found", details?: unknown) {
    return new AppError("NOT_FOUND", message, details);
  }

  static Conflict(message: string, details?: unknown) {
    return new AppError("CONFLICT", message, details);
  }

  static RateLimited(message: string = "Too Many Requests", details?: unknown) {
    return new AppError("RATE_LIMITED", message, details);
  }

  static Internal(
    message: string = "Internal Server Error",
    details?: unknown,
  ) {
    return new AppError("INTERNAL_SERVER_ERROR", message, details);
  }

  static Validation(message: string, details?: unknown) {
    return new AppError("VALIDATION_ERROR", message, details);
  }

  public toJSON() {
    return {
      success: false as const,
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
      },
    };
  }
}
