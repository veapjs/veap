import { beforeEach, describe, expect, it, vi } from "vitest";

// The encryption module reads ENCRYPTION_KEY at import time - set it before
// any import is evaluated (imports are hoisted, plain assignment is not).
vi.hoisted(() => {
  // Base64 of the 16 ASCII bytes "0123456789abcdef" - AES-128 requires an
  // exactly-16-byte key. The module validates key length at load and throws
  // without a valid key, so tests always provide one.
  process.env.ENCRYPTION_KEY = "MDEyMzQ1Njc4OWFiY2RlZg==";
});

import { BcryptPasswordHasher } from "../../../src/infrastructure/auth/adapters/bcrypt-password-hasher";
import { OsloTokenGenerator } from "../../../src/infrastructure/auth/adapters/oslo-token-generator";
import { AesSecretCipher } from "../../../src/infrastructure/auth/adapters/aes-secret-cipher";

/**
 * Cryptographic adapters - the concrete implementations behind the
 * IPasswordHasher / ITokenGenerator / ISecretCipher domain ports.
 *
 * Covered behaviours: round-trips (hash→verify, encrypt→decrypt), strength
 * policy, determinism of token hashing, and the shape/entropy of generated
 * tokens.
 */
describe("BcryptPasswordHasher", () => {
  let hasher: BcryptPasswordHasher;

  beforeEach(() => {
    hasher = new BcryptPasswordHasher();
  });

  it("round-trips hash → verify", async () => {
    const hash = await hasher.hash("correct horse battery staple");
    expect(hash).not.toBe("correct horse battery staple");
    await expect(
      hasher.verify(hash, "correct horse battery staple"),
    ).resolves.toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hasher.hash("password-123");
    await expect(hasher.verify(hash, "password-124")).resolves.toBe(false);
  });

  it("produces different hashes for the same password (salting)", async () => {
    const a = await hasher.hash("same-password");
    const b = await hasher.hash("same-password");
    expect(a).not.toBe(b);
  });

  it("enforces the strength policy (8–255 chars)", async () => {
    await expect(hasher.validateStrength("short")).resolves.toBe(false);
    await expect(hasher.validateStrength("12345678")).resolves.toBe(true);
    await expect(hasher.validateStrength("x".repeat(255))).resolves.toBe(true);
    await expect(hasher.validateStrength("x".repeat(256))).resolves.toBe(false);
  });
});

describe("OsloTokenGenerator", () => {
  let generator: OsloTokenGenerator;

  beforeEach(() => {
    generator = new OsloTokenGenerator();
  });

  it("generates OTPs of the requested length", () => {
    expect(generator.generateOtp(6)).toHaveLength(6);
    expect(generator.generateOtp(8)).toHaveLength(8);
  });

  it("generates session tokens that are non-empty and distinct", () => {
    const a = generator.generateSessionToken();
    const b = generator.generateSessionToken();
    expect(a.length).toBeGreaterThan(0);
    expect(a).not.toBe(b);
  });

  it("hashes tokens deterministically as lowercase hex SHA-256", () => {
    const first = generator.hashToken("session-token-value");
    const second = generator.hashToken("session-token-value");
    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
  });

  it("hashes different tokens to different digests", () => {
    expect(generator.hashToken("a")).not.toBe(generator.hashToken("b"));
  });
});

describe("AesSecretCipher", () => {
  let cipher: AesSecretCipher;

  beforeEach(() => {
    cipher = new AesSecretCipher();
  });

  it("round-trips encrypt → decryptToString", () => {
    const secret = "recovery-code-AB3D-XYZ";
    const encrypted = cipher.encrypt(secret);
    expect(Array.from(encrypted.slice(0, 4))).not.toEqual(
      Array.from(new TextEncoder().encode(secret).slice(0, 4)),
    );
    expect(cipher.decryptToString(encrypted)).toBe(secret);
  });

  it("produces different ciphertexts for the same plaintext (random IV)", () => {
    const a = cipher.encrypt("same secret");
    const b = cipher.encrypt("same secret");
    expect(Array.from(a)).not.toEqual(Array.from(b));
  });

  it("throws on tampered ciphertext (GCM auth tag)", () => {
    const encrypted = cipher.encrypt("integrity matters");
    const tampered = encrypted.slice();
    tampered[20] = (tampered[20] + 1) % 256;
    expect(() => cipher.decryptToString(tampered)).toThrow();
  });

  it("rejects truncated payloads", () => {
    expect(() => cipher.decryptToString(new Uint8Array(10))).toThrow();
  });
});
