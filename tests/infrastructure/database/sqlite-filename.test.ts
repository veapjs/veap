import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import {
  isSqliteDatabase,
  resolveSqliteFilename,
} from "../../../src/infrastructure/database/orm/connection";

const tmpDirs: string[] = [];

afterAll(() => {
  for (const dir of tmpDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isSqliteDatabase", () => {
  it("accepts single- and double-colon URL forms", () => {
    expect(isSqliteDatabase("sqlite:./storage/veap.sqlite")).toBe(true);
    expect(isSqliteDatabase("sqlite://./storage/veap.sqlite")).toBe(true);
    expect(isSqliteDatabase("file:./data.db")).toBe(true);
    expect(isSqliteDatabase("file://./data.db")).toBe(true);
  });

  it("accepts bare filenames and rejects postgres URLs", () => {
    expect(isSqliteDatabase("veap.sqlite")).toBe(true);
    expect(isSqliteDatabase("data.db")).toBe(true);
    expect(isSqliteDatabase("postgresql://user:pass@localhost:5432/db")).toBe(
      false,
    );
    expect(isSqliteDatabase(undefined)).toBe(false);
  });
});

describe("resolveSqliteFilename", () => {
  it("strips all URL prefix variants", () => {
    expect(resolveSqliteFilename("sqlite:./storage/veap.sqlite")).toBe(
      "./storage/veap.sqlite",
    );
    expect(resolveSqliteFilename("sqlite://./storage/veap.sqlite")).toBe(
      "./storage/veap.sqlite",
    );
    expect(resolveSqliteFilename("file:./data.db")).toBe("./data.db");
    expect(resolveSqliteFilename("file://./data.db")).toBe("./data.db");
  });

  it("keeps bare filenames untouched", () => {
    expect(resolveSqliteFilename("veap.sqlite")).toBe("veap.sqlite");
  });

  it("falls back to a default name for empty input", () => {
    expect(resolveSqliteFilename("sqlite://")).toBe("veap.sqlite");
  });

  it("creates the parent directory when missing (generated projects)", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "veap-sqlite-test-"));
    tmpDirs.push(dir);
    const nested = path.join(dir, "storage", "veap.sqlite");

    const resolved = resolveSqliteFilename(nested);
    expect(resolved).toBe(nested);
    expect(fs.existsSync(path.join(dir, "storage"))).toBe(true);
  });

  it("does not touch :memory: databases", () => {
    expect(resolveSqliteFilename(":memory:")).toBe(":memory:");
    expect(resolveSqliteFilename("sqlite::memory:")).toBe(":memory:");
  });

  it("redirects to /tmp on serverless environments", () => {
    vi.stubEnv("VERCEL", "1");
    expect(resolveSqliteFilename("sqlite:./storage/veap.sqlite")).toBe(
      "/tmp/veap.sqlite",
    );
  });
});
