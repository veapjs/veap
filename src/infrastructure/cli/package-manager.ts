import fs from "node:fs";
import path from "node:path";
import { stubPath } from "./stubs.js";

export type PackageManager = "pnpm" | "npm" | "yarn" | "bun";

interface Lockfile {
  file: string;
  pm: PackageManager;
}

const LOCKFILES: Lockfile[] = [
  { file: "pnpm-lock.yaml", pm: "pnpm" },
  { file: "bun.lock", pm: "bun" },
  { file: "bun.lockb", pm: "bun" },
  { file: "yarn.lock", pm: "yarn" },
  { file: "package-lock.json", pm: "npm" },
];

/**
 * Detects the package manager used by the project in `dir`.
 *
 * Priority: `packageManager` field in package.json > lockfiles > default (pnpm).
 * On conflicting lockfiles pnpm wins (framework default).
 */
export function detectPackageManager(dir: string): PackageManager {
  const pkgPath = path.join(dir, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      if (typeof pkg.packageManager === "string") {
        // Handles both "pnpm@11.9.0" and "pnpm@https://..." forms
        const name = pkg.packageManager.slice(
          0,
          pkg.packageManager.indexOf("@"),
        );
        if (
          name === "pnpm" ||
          name === "npm" ||
          name === "yarn" ||
          name === "bun"
        ) {
          return name;
        }
      }
    } catch {
      // malformed package.json - fall through to lockfiles
    }
  }

  const found = LOCKFILES.filter((l) => fs.existsSync(path.join(dir, l.file)));
  if (found.length > 0) {
    return found.find((l) => l.pm === "pnpm")?.pm ?? found[0].pm;
  }

  return "pnpm";
}

/**
 * Overwrites the generated pnpm Dockerfile with the variant matching `pm`.
 * No-op for pnpm (baseline stub), missing variants or missing Dockerfile -
 * best effort, Docker config is optional.
 */
export function applyDockerfileForPackageManager(
  projectDir: string,
  pm: PackageManager,
): void {
  if (pm === "pnpm") return;
  try {
    // Stubs live at the package root of the installed @veap/core.
    const variantPath = stubPath("docker", `Dockerfile.${pm}.stub`);
    const dockerfilePath = path.join(projectDir, "Dockerfile");
    if (!fs.existsSync(variantPath) || !fs.existsSync(dockerfilePath)) return;
    fs.writeFileSync(
      dockerfilePath,
      fs.readFileSync(variantPath, "utf-8"),
      "utf-8",
    );
  } catch {
    // best effort - docker config is optional
  }
}
