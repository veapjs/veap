import { createCipheriv, createDecipheriv } from "node:crypto";
import { DynamicBuffer } from "@oslojs/binary";
import { decodeBase64 } from "@oslojs/encoding";

/**
 * AES-128-GCM secret encryption for at-rest data (recovery codes, TOTP
 * secrets). The key is read once from the environment, base64-decoded and
 * validated at module load - an invalid configuration fails fast on boot
 * instead of surfacing as a cryptic `Invalid key length` on first use.
 *
 * The decoded key must be exactly 16, 24 or 32 bytes (AES-128/192/256).
 * Generate one with: `openssl rand -base64 16`
 */
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!ENCRYPTION_KEY) {
  throw new Error(
    "ENCRYPTION_KEY environment variable is not set. Generate one with: openssl rand -base64 16",
  );
}

const key = decodeBase64(ENCRYPTION_KEY);

if (key.length !== 16 && key.length !== 24 && key.length !== 32) {
  throw new Error(
    `ENCRYPTION_KEY must decode to 16, 24 or 32 bytes (got ${key.length}). ` +
      "Provide a base64-encoded key, e.g. from: openssl rand -base64 16",
  );
}

/** AES-GCM variant matching the configured key size. */
const ALGORITHM =
  key.length === 16
    ? "aes-128-gcm"
    : key.length === 24
      ? "aes-192-gcm"
      : "aes-256-gcm";

/**
 * Encrypts data using AES-128-GCM.
 * @param data Data to be encrypted.
 * @returns Encrypted data including IV and auth tag.
 */
export function encrypt(data: Uint8Array): Uint8Array {
  const iv = new Uint8Array(16);
  crypto.getRandomValues(iv);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = new DynamicBuffer(0);
  encrypted.write(iv);
  encrypted.write(cipher.update(data));
  encrypted.write(cipher.final());
  encrypted.write(cipher.getAuthTag());
  return encrypted.bytes();
}

/**
 * Encrypts a string.
 * @param data String to be encrypted.
 * @returns Encrypted data as Uint8Array.
 */
export function encryptString(data: string): Uint8Array {
  return encrypt(new TextEncoder().encode(data));
}

/**
 * Decrypts data using AES-128-GCM.
 * @param encrypted Encrypted data (IV + content + auth tag).
 * @returns Decrypted data.
 */
export function decrypt(encrypted: Uint8Array): Uint8Array {
  if (encrypted.byteLength < 33) {
    throw new Error("Invalid encrypted data length");
  }
  const iv = encrypted.slice(0, 16);
  const authTag = encrypted.slice(encrypted.byteLength - 16);
  const content = encrypted.slice(16, encrypted.byteLength - 16);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = new DynamicBuffer(0);
  decrypted.write(decipher.update(content));
  decrypted.write(decipher.final());
  return decrypted.bytes();
}

/**
 * Decrypts data to a string.
 * @param data Encrypted data.
 * @returns Decrypted string.
 */
export function decryptToString(data: Uint8Array): string {
  return new TextDecoder().decode(decrypt(data));
}
