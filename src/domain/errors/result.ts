import type { AppError } from "./app-error";
import type { ErrorCode } from "./types";

export type AppErrorJson = {
  code: ErrorCode;
  message: string;
  details?: unknown;
};

export type Result<T> =
  | { success: true; data: T; error?: never }
  | { success: false; error: AppErrorJson; data?: never };

export function ok<T>(data: T): Result<T> {
  return { success: true, data };
}
