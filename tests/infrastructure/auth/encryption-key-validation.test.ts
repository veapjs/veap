import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Configuration contract of `infrastructure/auth/utils/encryption`:
 * the AES key is read from ENCRYPTION_KEY once, at module load, and an
 * invalid configuration must fail fast with a readable error - never with
 * a cryptic `Invalid key length` on first encryption.
 *
 * The module throws at import time, so each test re-evaluates it with a
 * fresh module registry (`vi.resetModules`) after stubbing the environment.
 */

const MODULE_PATH = "../../../src/infrastructure/auth/utils/encryption";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("ENCRYPTION_KEY configuration contract", () => {
  it("throws when the variable is missing (no silent fallback)", async () => {
    vi.stubEnv("ENCRYPTION_KEY", "");
    vi.resetModules();

    await expect(() => import(MODULE_PATH)).rejects.toThrow(
      /ENCRYPTION_KEY environment variable is not set/,
    );
  });

  it('rejects the legacy 13-byte default (base64 of "my_secure_key")', async () => {
    vi.stubEnv("ENCRYPTION_KEY", "bXlfc2VjdXJlX2tleQ==");
    vi.resetModules();

    await expect(() => import(MODULE_PATH)).rejects.toThrow(
      /must decode to 16, 24 or 32 bytes \(got 13\)/,
    );
  });

  it("rejects keys decoding to lengths outside 16/24/32", async () => {
    // 8 ASCII bytes, base64-encoded.
    vi.stubEnv("ENCRYPTION_KEY", "MTIzNDU2Nzg=");
    vi.resetModules();

    await expect(() => import(MODULE_PATH)).rejects.toThrow(
      /must decode to 16, 24 or 32 bytes \(got 8\)/,
    );
  });

  it("accepts a 16-byte key (AES-128 round-trip)", async () => {
    // Base64 of the 16 ASCII bytes "0123456789abcdef".
    vi.stubEnv("ENCRYPTION_KEY", "MDEyMzQ1Njc4OWFiY2RlZg==");
    vi.resetModules();

    const { encryptString, decryptToString } = await import(MODULE_PATH);
    expect(decryptToString(encryptString("recovery-code"))).toBe(
      "recovery-code",
    );
  });

  it("accepts a 32-byte key (AES-256 round-trip)", async () => {
    // Base64 of 32 ASCII bytes.
    vi.stubEnv(
      "ENCRYPTION_KEY",
      Buffer.from("a".repeat(32), "ascii").toString("base64"),
    );
    vi.resetModules();

    const { encryptString, decryptToString } = await import(MODULE_PATH);
    expect(decryptToString(encryptString("totp-secret"))).toBe("totp-secret");
  });
});
