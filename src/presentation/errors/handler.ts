import { AppError } from "../../domain/errors/app-error";
import { error as logError } from "../../infrastructure/logging/console-logger";
import type { Result } from "../../domain/errors/result";

export function handleActionError(e: unknown, context?: string): Result<never> {
  // Jeśli to jest błąd z Next.js (np. redirect, notFound), ma on właściwość digest
  if (e instanceof Error && "digest" in e && typeof e.digest === "string") {
    if (e.digest.startsWith("NEXT_REDIRECT") || e.digest === "NEXT_NOT_FOUND") {
      throw e;
    }
  }

  if (e instanceof AppError) {
    return e.toJSON();
  }

  if (e instanceof Error) {
    logError(
      context || "ErrorHandler",
      `Unhandled error: ${e.message}`,
      e.stack,
    );
    return AppError.Internal(e.message).toJSON();
  }

  logError(context || "ErrorHandler", "Unknown error", e);
  return AppError.Internal("An unexpected error occurred").toJSON();
}
