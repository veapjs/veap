import type { PasswordResetSession } from "../types";

/** A password reset session together with its owner. */
export interface PasswordResetWithUser {
  session: PasswordResetSession;
  user: Record<string, any>;
}

export interface CreatePasswordResetRecord {
  id: string;
  userId: string;
  email: string;
  code: string;
  expiresAt: Date;
}

/** Password reset session persistence port. */
export interface IPasswordResetRepository {
  create(record: CreatePasswordResetRecord): Promise<PasswordResetSession>;

  /**
   * Returns the reset session with its owner eager-loaded, or `null` when
   * either of them is missing.
   */
  findWithUser(id: string): Promise<PasswordResetWithUser | null>;

  setEmailVerified(id: string): Promise<void>;

  remove(id: string): Promise<void>;

  removeByUserId(userId: string): Promise<void>;
}

/** Injection token for the password reset repository port. */
export const PASSWORD_RESET_REPOSITORY = Symbol.for(
  "veap:auth:password-reset-repository",
);
