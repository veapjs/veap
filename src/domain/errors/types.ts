export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "BAD_REQUEST"
  | "INTERNAL_SERVER_ERROR"
  | "CONFLICT"
  | "RATE_LIMITED";

export interface IAppError {
  code: ErrorCode;
  message: string;
  details?: unknown;
}
