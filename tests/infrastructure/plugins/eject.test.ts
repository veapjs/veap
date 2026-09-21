import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { ejectPackage } from "../../../src/infrastructure/plugins/cli/eject";

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

vi.mock("ora", () => ({
  default: () => ({
    start: () => ({
      succeed: vi.fn(),
      fail: vi.fn(),
    }),
  }),
}));

describe("ejectPackage CLI", () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "veap-eject-test-"));
    process.chdir(tmpDir);
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("ejects a template into templates/ directory when veap.type is template", async () => {
    // Setup root package.json
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify(
        {
          name: "test-app",
          workspaces: ["packages/*"],
          dependencies: {
            "@veap/custom-template": "^1.0.0",
          },
        },
        null,
        2,
      ),
    );

    // Setup node_modules package
    const modDir = path.join(
      tmpDir,
      "node_modules",
      "@veap",
      "custom-template",
    );
    fs.mkdirSync(modDir, { recursive: true });
    fs.writeFileSync(
      path.join(modDir, "package.json"),
      JSON.stringify(
        {
          name: "@veap/custom-template",
          repository: "https://github.com/the-veap/custom-template.git",
          veap: {
            type: "template",
          },
        },
        null,
        2,
      ),
    );

    await ejectPackage("@veap/custom-template");

    // Expect git clone to have been called for templates/custom-template
    const expectedDest = path.join(tmpDir, "templates", "custom-template");
    expect(execSync).toHaveBeenCalledWith(
      `git clone https://github.com/the-veap/custom-template.git "${expectedDest}"`,
      { stdio: "ignore" },
    );

    // Verify root package.json was updated with workspace:* and workspaces array updated
    const updatedPkg = JSON.parse(
      fs.readFileSync(path.join(tmpDir, "package.json"), "utf-8"),
    );
    expect(updatedPkg.dependencies["@veap/custom-template"]).toBe(
      "workspace:*",
    );
    expect(updatedPkg.workspaces).toContain("templates/*");
  });

  it("ejects a plugin into plugins/ directory when veap.type is plugin", async () => {
    // Setup root package.json
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify(
        {
          name: "test-app",
          workspaces: ["packages/*"],
          dependencies: {
            "@veap/shop-plugin": "^1.0.0",
          },
        },
        null,
        2,
      ),
    );

    // Setup node_modules package
    const modDir = path.join(tmpDir, "node_modules", "@veap", "shop-plugin");
    fs.mkdirSync(modDir, { recursive: true });
    fs.writeFileSync(
      path.join(modDir, "package.json"),
      JSON.stringify(
        {
          name: "@veap/shop-plugin",
          repository: {
            url: "git+https://github.com/the-veap/shop-plugin.git",
          },
          veap: {
            type: "plugin",
          },
        },
        null,
        2,
      ),
    );

    await ejectPackage("@veap/shop-plugin");

    // Expect git clone to have been called for plugins/shop-plugin
    const expectedDest = path.join(tmpDir, "plugins", "shop-plugin");
    expect(execSync).toHaveBeenCalledWith(
      `git clone https://github.com/the-veap/shop-plugin.git "${expectedDest}"`,
      { stdio: "ignore" },
    );

    // Verify root package.json was updated with workspace:* and workspaces array updated
    const updatedPkg = JSON.parse(
      fs.readFileSync(path.join(tmpDir, "package.json"), "utf-8"),
    );
    expect(updatedPkg.dependencies["@veap/shop-plugin"]).toBe("workspace:*");
    expect(updatedPkg.workspaces).toContain("plugins/*");
  });
});
