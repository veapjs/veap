import { encodeBase32UpperCaseNoPadding } from "@oslojs/encoding";

/**
 * Generates a random one-time code (OTP).
 * @param length Length of the generated code (default 6).
 * @returns A random uppercase base32 string.
 */
export function generateRandomOTP(length = 6): string {
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  return encodeBase32UpperCaseNoPadding(bytes).substring(0, length);
}

/**
 * Generates a random recovery code.
 * @returns A random uppercase base32 string.
 */
export function generateRandomRecoveryCode(): string {
  const recoveryCodeBytes = new Uint8Array(10);
  crypto.getRandomValues(recoveryCodeBytes);
  return encodeBase32UpperCaseNoPadding(recoveryCodeBytes);
}
