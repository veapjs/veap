/**
 * Password hashing port.
 *
 * Application services must not know that passwords are hashed with bcrypt
 * (or any other concrete algorithm) - that is an infrastructure detail.
 * Adapters live in `infrastructure/auth/adapters/` and are bound to
 * `PASSWORD_HASHER` by `AuthServiceProvider`.
 */
export interface IPasswordHasher {
  /** Creates a secure hash of a plaintext password. */
  hash(password: string): Promise<string>;

  /** Verifies a plaintext password against a stored hash. */
  verify(hash: string, password: string): Promise<boolean>;

  /** Validates password complexity/length requirements. */
  validateStrength(password: string): Promise<boolean>;
}

export const PASSWORD_HASHER = Symbol.for("veap:auth:password-hasher");
