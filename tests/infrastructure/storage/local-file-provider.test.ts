import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ConfigService } from "../../../src/infrastructure/config/config.service";
import { LocalFileProvider } from "../../../src/infrastructure/storage/providers/local";

describe("LocalFileProvider Security", () => {
  let tempDir: string;
  let provider: LocalFileProvider;
  let config: ConfigService;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "veap-storage-test-"));
    config = {
      get: (key: string) => (key === "FILE_STORAGE_FOLDER" ? tempDir : undefined),
    } as any;
    provider = new LocalFileProvider(config);
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it("blocks dangerous file extensions like .html, .svg, .php, .exe, .sh", async () => {
    const dangerousExtensions = [
      "evil.html",
      "vector.svg",
      "script.php",
      "malware.exe",
      "run.sh",
      "exploit.js",
      "hack.phtml",
      "test.xhtml",
      ".htaccess",
    ];

    for (const filename of dangerousExtensions) {
      const file = new File(["<script>alert(1)</script>"], filename, {
        type: "text/plain",
      });
      const result = await provider.upload(file);
      expect(result).toHaveProperty("error");
      expect((result as any).error).toMatch(/not allowed for security reasons/i);
    }
  });

  it("allows safe file uploads like .png, .jpg, .pdf", async () => {
    const file = new File(["fake-image-bytes"], "photo.png", {
      type: "image/png",
    });
    const result = await provider.upload(file);
    expect(result).not.toHaveProperty("error");
    expect((result as any).name).toMatch(/photo-.*\.png/);
    expect(fs.existsSync((result as any).serviceId)).toBe(true);
  });

  it("sanitizes directory traversal in uploaded filename", async () => {
    const file = new File(["safe"], "../../../traversal.png", {
      type: "image/png",
    });
    const result = await provider.upload(file);
    expect(result).not.toHaveProperty("error");
    // Verify file was written inside tempDir, not escaped
    const relative = path.relative(tempDir, (result as any).serviceId);
    expect(relative.startsWith("..")).toBe(false);
  });

  it("blocks directory traversal in delete()", async () => {
    const outsideFile = path.join(os.tmpdir(), "veap-do-not-delete.txt");
    fs.writeFileSync(outsideFile, "secret");

    try {
      // Attempt to delete file outside storage folder via path traversal
      const blocked = await provider.delete("../veap-do-not-delete.txt");
      expect(blocked).toBe(false);
      expect(fs.existsSync(outsideFile)).toBe(true);
    } finally {
      try {
        fs.unlinkSync(outsideFile);
      } catch {}
    }
  });
});
