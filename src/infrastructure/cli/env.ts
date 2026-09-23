import fs from "node:fs";
import path from "node:path";
import { findProjectRoot } from "./utils.js";

function loadEnvFileFallback(filePath: string): void {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx <= 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) {
        process.env[key] = val;
      }
    }
  } catch {}
}

/**
 * Loads environment variables from .env files (.env.local, .env, etc.)
 * matching Next.js resolution rules and precedence.
 */
export function loadEnv(startDir: string = process.cwd()): void {
  const mode = process.env.NODE_ENV || "development";
  const envFileNames = [
    `.env.${mode}.local`,
    mode !== "test" ? ".env.local" : null,
    `.env.${mode}`,
    ".env",
  ].filter(Boolean) as string[];

  const dirs = [startDir];
  try {
    const rootDir = findProjectRoot(startDir);
    if (rootDir && rootDir !== startDir) {
      dirs.push(rootDir);
    }
  } catch {}

  for (const dir of dirs) {
    for (const file of envFileNames) {
      const fullPath = path.join(dir, file);
      if (fs.existsSync(fullPath)) {
        if (typeof (process as any).loadEnvFile === "function") {
          try {
            (process as any).loadEnvFile(fullPath);
          } catch {
            loadEnvFileFallback(fullPath);
          }
        } else {
          loadEnvFileFallback(fullPath);
        }
      }
    }
  }

  // Ensure ENCRYPTION_KEY exists in CLI context so module-level guards
  // do not crash command discovery if .env is missing or incomplete.
  if (!process.env.ENCRYPTION_KEY) {
    process.env.ENCRYPTION_KEY = "AAAAAAAAAAAAAAAAAAAAAA==";
  }
}
