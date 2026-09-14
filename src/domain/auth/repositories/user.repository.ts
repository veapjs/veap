import type { User } from "../types";

/**
 * Payload accepted by {@link IUserRepository.create}.
 *
 * `recoveryCode` is expected to be already encrypted - encryption is a domain
 * concern handled by the use case, the repository only persists bytes.
 */
export interface CreateUserRecord {
  email: string;
  name: string;
  password?: string | null;
  image?: string | null;
  emailVerifiedAt?: Date | null;
  recoveryCode: Uint8Array;
}

/**
 * Partial update payload. Keys mirror the persistence columns so adapters can
 * forward them without translation.
 */
export interface UpdateUserRecord {
  name?: string;
  email?: string;
  image?: string | null;
  password?: string;
  emailVerifiedAt?: Date | null;
}

/**
 * User persistence port.
 *
 * The application layer depends on this abstraction only; the ActiveRecord
 * implementation lives in `infrastructure/auth/repositories`.
 */
export interface IUserRepository {
  create(record: CreateUserRecord): Promise<User>;

  findById(id: string): Promise<User | null>;

  findByEmail(email: string): Promise<User | null>;

  /**
   * Returns `undefined` when the user does not exist and `null` when the user
   * exists but has no password (e.g. OAuth-only accounts).
   */
  findPasswordHash(id: string): Promise<string | null | undefined>;

  /**
   * Returns the stored (encrypted) recovery code.
   * `undefined` means "no such user", `null` means "user has no recovery code".
   */
  findRecoveryCode(id: string): Promise<Uint8Array | null | undefined>;

  update(id: string, changes: UpdateUserRecord): Promise<void>;

  setRecoveryCode(id: string, encrypted: Uint8Array): Promise<void>;

  /** Marks the email as verified only when it still matches `email`. */
  setEmailVerifiedIfEmailMatches(id: string, email: string): Promise<boolean>;
}

/** Injection token for the user repository port. */
export const USER_REPOSITORY = Symbol.for("veap:auth:user-repository");
