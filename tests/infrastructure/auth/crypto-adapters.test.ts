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
import { Container } from "../../../src/infrastructure/ioc/container";
import { ConfigService } from "../../../src/infrastructure/config/config.service";
import { AuthServiceProvider } from "../../../src/infrastructure/auth/provider";
import { PASSWORD_HASHER } from "../../../src/domain/auth/ports/password-hasher";

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

  it("enforces the strength policy (8–255 chars by default)", async () => {
    await expect(hasher.validateStrength("short")).resolves.toBe(false);
    await expect(hasher.validateStrength("12345678")).resolves.toBe(true);
    await expect(hasher.validateStrength("x".repeat(255))).resolves.toBe(true);
    await expect(hasher.validateStrength("x".repeat(256))).resolves.toBe(false);
  });

  it("supports configurable bcrypt cost (salt rounds)", async () => {
    const fastHasher = new BcryptPasswordHasher(4);
    expect(fastHasher.rounds).toBe(4);

    const hash = await fastHasher.hash("password");
    // Bcrypt hash with cost 4 starts with $2a$04$ or $2b$04$
    expect(hash).toMatch(/^\$2[ab]\$04\$/);
    await expect(fastHasher.verify(hash, "password")).resolves.toBe(true);
  });

  it("falls back to cost 10 when invalid or out-of-bounds rounds are provided", () => {
    expect(new BcryptPasswordHasher(2).rounds).toBe(10);
    expect(new BcryptPasswordHasher(35).rounds).toBe(10);
    expect(new BcryptPasswordHasher(NaN).rounds).toBe(10);
  });

  it("supports configurable minimum password length", async () => {
    const strictHasher = new BcryptPasswordHasher(undefined, 12);
    expect(strictHasher.minLength).toBe(12);

    await expect(strictHasher.validateStrength("12345678")).resolves.toBe(false);
    await expect(strictHasher.validateStrength("123456789012")).resolves.toBe(true);
  });

  it("reads configuration from process.env when arguments are omitted", () => {
    const originalRounds = process.env.AUTH_BCRYPT_ROUNDS;
    const originalMinLength = process.env.AUTH_PASSWORD_MIN_LENGTH;
    try {
      process.env.AUTH_BCRYPT_ROUNDS = "6";
      process.env.AUTH_PASSWORD_MIN_LENGTH = "10";

      const envHasher = new BcryptPasswordHasher();
      expect(envHasher.rounds).toBe(6);
      expect(envHasher.minLength).toBe(10);
    } finally {
      if (originalRounds !== undefined) {
        process.env.AUTH_BCRYPT_ROUNDS = originalRounds;
      } else {
        delete process.env.AUTH_BCRYPT_ROUNDS;
      }
      if (originalMinLength !== undefined) {
        process.env.AUTH_PASSWORD_MIN_LENGTH = originalMinLength;
      } else {
        delete process.env.AUTH_PASSWORD_MIN_LENGTH;
      }
    }
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

describe("AuthServiceProvider PASSWORD_HASHER binding", () => {
  it("resolves PASSWORD_HASHER from Container with configured rounds and length", async () => {
    const container = new Container();
    const config = new ConfigService();
    container.register({
      token: ConfigService,
      useValue: config,
    });

    const provider = new AuthServiceProvider(container);
    provider.register();

    const hasher = await container.resolve<BcryptPasswordHasher>(PASSWORD_HASHER);
    expect(hasher).toBeInstanceOf(BcryptPasswordHasher);
    expect(hasher.rounds).toBe(10);
    expect(hasher.minLength).toBe(8);
  });
});
