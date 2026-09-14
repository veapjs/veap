/**
 * Secret-token generation port.
 *
 * Generation of OTP codes, recovery codes, session tokens and the hashing of
 * tokens for storage are cryptographic infrastructure concerns. Application
 * services depend on this contract; the Oslo-based adapter lives in
 * `infrastructure/auth/adapters/` and is bound to `TOKEN_GENERATOR` by
 * `AuthServiceProvider`.
 */
export interface ITokenGenerator {
  /** Generates a random one-time code (default 6 characters, uppercase base32). */
  generateOtp(length?: number): string;

  /** Generates a random recovery code (uppercase base32). */
  generateRecoveryCode(): string;

  /** Generates a random session token (lowercase base32). */
  generateSessionToken(): string;

  /** Hashes a token for storage/lookup (deterministic, keyed by content). */
  hashToken(token: string): string;
}

export const TOKEN_GENERATOR = Symbol.for("veap:auth:token-generator");
