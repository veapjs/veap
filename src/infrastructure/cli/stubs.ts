import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Locates the package-root `stubs/` directory of the installed @veap/framework.
 *
 * Every stub-based CLI command (docker, make:plugin, make:template) resolves
 * its templates through this resolver instead of hard-coded relative walks.
 * It anchors on the nearest package.json belonging to @veap/framework, so the
 * result is correct regardless of how deep the calling module sits in `dist/`
 * and regardless of the package layout (npm, pnpm's .pnpm store, yarn, bun).
 *
 * Convention: `stubs/` lives at the package root next to `bin/` and `dist/`
 * (the same convention as create-veap) and is shipped in the npm package via
 * the "files" field in package.json.
 */
export function findStubsDir(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url));

  for (;;) {
    const pkgPath = path.join(dir, "package.json");
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as {
          name?: string;
        };
        if (pkg.name === "@veap/framework") {
          return path.join(dir, "stubs");
        }
      } catch {
        // Malformed package.json - keep walking up.
      }
    }

    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(
        "Unable to locate the @veap/framework package root. The 'stubs' directory ships with the @veap/framework package; reinstall it or run the CLI from a project that depends on it.",
      );
    }
    dir = parent;
  }
}

/** Resolves a path inside the package-root stubs directory. */
export function stubPath(...segments: string[]): string {
  return path.join(findStubsDir(), ...segments);
}
