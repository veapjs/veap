import { describe, expect, it } from "vitest";
import { resolvePostgresSslConfig } from "../../../src/infrastructure/database/orm/connection";

describe("resolvePostgresSslConfig", () => {
  const prodUrl = "postgres://user:pass@ep-cool-db.neon.tech/neondb";

  describe("production environment (isProd = true)", () => {
    it("enables SSL with rejectUnauthorized = true by default (secure by default)", () => {
      const result = resolvePostgresSslConfig({
        databaseUrl: prodUrl,
        isProd: true,
      });

      expect(result).toEqual({ rejectUnauthorized: true });
    });

    it("allows disabling certificate verification via DATABASE_SSL_REJECT_UNAUTHORIZED='false'", () => {
      const result = resolvePostgresSslConfig({
        databaseUrl: prodUrl,
        isProd: true,
        rejectUnauthorizedEnv: "false",
      });

      expect(result).toEqual({ rejectUnauthorized: false });
    });

    it("allows disabling certificate verification via DATABASE_SSL_REJECT_UNAUTHORIZED='0'", () => {
      const result = resolvePostgresSslConfig({
        databaseUrl: prodUrl,
        isProd: true,
        rejectUnauthorizedEnv: "0",
      });

      expect(result).toEqual({ rejectUnauthorized: false });
    });

    it("keeps certificate verification when DATABASE_SSL_REJECT_UNAUTHORIZED='true'", () => {
      const result = resolvePostgresSslConfig({
        databaseUrl: prodUrl,
        isProd: true,
        rejectUnauthorizedEnv: "true",
      });

      expect(result).toEqual({ rejectUnauthorized: true });
    });

    it("allows disabling certificate verification via sslmode=no-verify in DATABASE_URL", () => {
      const result = resolvePostgresSslConfig({
        databaseUrl: `${prodUrl}?sslmode=no-verify`,
        isProd: true,
      });

      expect(result).toEqual({ rejectUnauthorized: false });
    });

    it("allows disabling certificate verification via rejectUnauthorized=false in DATABASE_URL", () => {
      const result = resolvePostgresSslConfig({
        databaseUrl: `${prodUrl}?rejectUnauthorized=false`,
        isProd: true,
      });

      expect(result).toEqual({ rejectUnauthorized: false });
    });

    it("disables SSL entirely when sslmode=disable is present", () => {
      const result = resolvePostgresSslConfig({
        databaseUrl: `${prodUrl}?sslmode=disable`,
        isProd: true,
      });

      expect(result).toBe(false);
    });

    it("passes custom CA bundle when caCert is provided", () => {
      const ca =
        "-----BEGIN CERTIFICATE-----\nFAKE_CA_BUNDLE\n-----END CERTIFICATE-----";
      const result = resolvePostgresSslConfig({
        databaseUrl: prodUrl,
        isProd: true,
        caCert: ca,
      });

      expect(result).toEqual({
        rejectUnauthorized: true,
        ca,
      });
    });

    it("env variable takes precedence over URL parameter for rejectUnauthorized", () => {
      // URL says no-verify, but env explicitly requires verification
      const result = resolvePostgresSslConfig({
        databaseUrl: `${prodUrl}?sslmode=no-verify`,
        isProd: true,
        rejectUnauthorizedEnv: "true",
      });

      expect(result).toEqual({ rejectUnauthorized: true });
    });
  });

  describe("development / non-production environment (isProd = false)", () => {
    const devUrl = "postgres://localhost:5432/veap_dev";

    it("disables SSL by default in development without SSL query parameters", () => {
      const result = resolvePostgresSslConfig({
        databaseUrl: devUrl,
        isProd: false,
      });

      expect(result).toBe(false);
    });

    it("enables SSL with rejectUnauthorized = true when sslmode=require is in DATABASE_URL", () => {
      const result = resolvePostgresSslConfig({
        databaseUrl: `${devUrl}?sslmode=require`,
        isProd: false,
      });

      expect(result).toEqual({ rejectUnauthorized: true });
    });

    it("enables SSL with rejectUnauthorized = true when ssl=true is in DATABASE_URL", () => {
      const result = resolvePostgresSslConfig({
        databaseUrl: `${devUrl}?ssl=true`,
        isProd: false,
      });

      expect(result).toEqual({ rejectUnauthorized: true });
    });

    it("enables SSL with rejectUnauthorized = false when sslmode=no-verify is in DATABASE_URL", () => {
      const result = resolvePostgresSslConfig({
        databaseUrl: `${devUrl}?sslmode=no-verify`,
        isProd: false,
      });

      expect(result).toEqual({ rejectUnauthorized: false });
    });

    it("disables SSL when sslmode=disable is in DATABASE_URL even with ssl=true", () => {
      const result = resolvePostgresSslConfig({
        databaseUrl: `${devUrl}?sslmode=disable`,
        isProd: false,
      });

      expect(result).toBe(false);
    });
  });
});
