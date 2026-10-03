import fs from "node:fs";
import path from "node:path";

/**
 * Workspace root markers used to locate the project root, checked from the
 * current directory upwards. Covers all supported package managers: lockfiles
 * for pnpm/bun/yarn/npm plus the pnpm workspace manifest. The `workspaces`
 * field in package.json (npm, yarn classic, bun) is checked separately.
 */
const WORKSPACE_MARKERS = [
  "pnpm-lock.yaml",
  "bun.lock",
  "bun.lockb",
  "yarn.lock",
  "package-lock.json",
  "pnpm-workspace.yaml",
];

function hasWorkspacesField(dir: string): boolean {
  const pkgPath = path.join(dir, "package.json");
  if (!fs.existsSync(pkgPath)) return false;
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    const workspaces = pkg.workspaces;
    if (Array.isArray(workspaces) && workspaces.length > 0) return true;
    return (
      !!workspaces &&
      typeof workspaces === "object" &&
      Array.isArray((workspaces as { packages?: unknown }).packages) &&
      (workspaces as { packages: unknown[] }).packages.length > 0
    );
  } catch {
    return false;
  }
}

export function findProjectRoot(currentDir: string): string {
  if (
    WORKSPACE_MARKERS.some((marker) =>
      fs.existsSync(path.join(currentDir, marker)),
    ) ||
    hasWorkspacesField(currentDir)
  ) {
    return currentDir;
  }
  const parentDir = path.dirname(currentDir);
  if (parentDir === currentDir) {
    return process.cwd();
  }
  return findProjectRoot(parentDir);
}

export function processStubs(
  srcDir: string,
  destDir: string,
  variables: Record<string, string>,
) {
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  const entries = fs.readdirSync(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    let destName = entry.name;
    for (const [key, value] of Object.entries(variables)) {
      destName = destName.replace(
        new RegExp("\\{\\{" + key + "\\}\\}", "g"),
        value,
      );
    }

    if (destName.endsWith(".stub")) {
      destName = destName.slice(0, -5);
    }

    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, destName);

    if (entry.isDirectory()) {
      processStubs(srcPath, destPath, variables);
    } else {
      let content = fs.readFileSync(srcPath, "utf-8");
      for (const [key, value] of Object.entries(variables)) {
        content = content.replace(
          new RegExp("\\{\\{" + key + "\\}\\}", "g"),
          value,
        );
      }
      fs.writeFileSync(destPath, content);
    }
  }
}
