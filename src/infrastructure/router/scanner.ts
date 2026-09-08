import * as fs from "node:fs";
import * as path from "node:path";
import { debug } from "../logging";
import type { RouteNode } from "../../application/router/route-tree";

// ---------------------------------------------------------------------------
// File conventions
// ---------------------------------------------------------------------------

const ROUTE_FILES = {
  page: ["page.tsx", "page.ts", "page.jsx", "page.js"],
  layout: ["layout.tsx", "layout.ts", "layout.jsx", "layout.js"],
  loading: ["loading.tsx", "loading.ts", "loading.jsx", "loading.js"],
  error: ["error.tsx", "error.ts", "error.jsx", "error.js"],
  notFound: ["not-found.tsx", "not-found.ts", "not-found.jsx", "not-found.js"],
  default: ["default.tsx", "default.ts", "default.jsx", "default.js"],
  route: ["route.ts", "route.js"],
} as const;

type RouteFileKey = keyof typeof ROUTE_FILES;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Directories that should never be scanned. */
const IGNORED_DIRS = new Set(["node_modules"]);

function shouldSkipDir(name: string): boolean {
  if (IGNORED_DIRS.has(name)) return true;
  if (name.startsWith(".")) return true;
  if (name.startsWith("_")) return true;
  return false;
}

/**
 * Determine the segment string from a directory name.
 *
 * Directory names map directly to RouteNode segments using App Router syntax:
 * - `(group)` → route group (segment = `(group)`, logically transparent)
 * - `@slot`   → parallel slot (handled separately via `parallelRoutes`)
 * - `[param]` → dynamic segment `[param]`
 * - `[...param]` → catch-all `[...param]`
 * - `[[...param]]` → optional catch-all `[[...param]]`
 * - anything else → literal segment
 */
function dirNameToSegment(dirName: string): string {
  // All bracket-based segments are kept as-is - the RouteTree
  // matching algorithm understands [param], [...param], [[...param]]
  // Route groups (parenthesized) are also kept as-is
  return dirName;
}

/**
 * Returns the sort priority for a segment.
 * Lower value = higher priority (sorted first).
 *
 * Static > Group > Dynamic > Catch-all > Optional catch-all
 */
function segmentSortOrder(segment: string): number {
  if (/^\[\[\.\.\./.test(segment)) return 4; // optional catch-all [[...param]]
  if (/^\[\.\.\./.test(segment)) return 3; // catch-all [...param]
  if (/^\[[^[\].]+\]$/.test(segment)) return 2; // dynamic [param]
  if (segment.startsWith("(")) return 1; // group
  return 0; // static
}

/**
 * Finds the first matching file from a list of candidates in a directory.
 */
function findRouteFile(
  dir: string,
  candidates: readonly string[],
): string | null {
  for (const candidate of candidates) {
    const fullPath = path.join(dir, candidate);
    if (fs.existsSync(fullPath)) return fullPath;
  }
  return null;
}

/**
 * Sanitize a directory name for use as a TypeScript import identifier.
 *
 * - `[slug]`       → `_slug_`
 * - `[...slug]`    → `_spread_slug_`
 * - `[[...slug]]`  → `_optspread_slug_`
 * - `(group)`      → `group`
 * - `@modal`       → `_at_modal`
 * - other specials  → underscored
 */
function sanitizeImportName(dirName: string): string {
  // Optional catch-all
  const optCatchAll = dirName.match(/^\[\[\.\.\.(\w+)\]\]$/);
  if (optCatchAll) return `_optspread_${optCatchAll[1]}_`;

  // Catch-all
  const catchAll = dirName.match(/^\[\.\.\.(\w+)\]$/);
  if (catchAll) return `_spread_${catchAll[1]}_`;

  // Dynamic
  const dynamic = dirName.match(/^\[(\w+)\]$/);
  if (dynamic) return `_${dynamic[1]}_`;

  // Route group
  if (dirName.startsWith("(") && dirName.endsWith(")")) {
    return dirName.slice(1, -1);
  }

  // Parallel slot
  if (dirName.startsWith("@")) {
    return `_at_${dirName.slice(1)}`;
  }

  return dirName.replace(/[^a-zA-Z0-9_]/g, "_");
}

// ---------------------------------------------------------------------------
// Runtime route discovery
// ---------------------------------------------------------------------------

export async function discoverRoutes(
  appDir: string,
  dynamicImport?: (relPath: string) => Promise<any>,
): Promise<RouteNode> {
  return scanDirectory(appDir, "", appDir, dynamicImport);
}

async function scanDirectory(
  dir: string,
  segment: string,
  baseAppDir: string,
  dynamicImport?: (relPath: string) => Promise<any>,
): Promise<RouteNode> {
  const relPathToDir = path.relative(baseAppDir, dir).split(path.sep).join("/");
  const nodeId = relPathToDir === "" ? "/" : `/${relPathToDir}`;
  const node: RouteNode = { segment, id: nodeId };

  // Discover route files
  for (const [key, candidates] of Object.entries(ROUTE_FILES)) {
    const filePath = findRouteFile(dir, candidates);
    if (filePath) {
      let mod: any;
      if (dynamicImport) {
        // Calculate relative path from baseAppDir (e.g. "(marketing)/about/page.js")
        // We use path.posix to ensure forward slashes for the import string
        const relPath = path
          .relative(baseAppDir, filePath)
          .split(path.sep)
          .join("/");
        mod = await dynamicImport(relPath);
      } else {
        // Fallback to bypass bundler (breaks HMR and next/link)
        const isDev = process.env.NODE_ENV === "development";
        const importPath = isDev ? `${filePath}?v=${Date.now()}` : filePath;
        mod = await import(/* turbopackIgnore: true */ importPath);
      }

      const exported = mod.default ?? mod;

      switch (key as RouteFileKey) {
        case "page":
          node.page = exported;
          break;
        case "layout":
          node.layout = exported;
          break;
        case "loading":
          node.loading = exported;
          break;
        case "error":
          node.error = exported;
          break;
        case "notFound":
          node.notFound = exported;
          break;
        case "default":
          node.default = exported;
          break;
        case "route":
          node.route = exported;
          break;
      }

      // Check for generateMetadata export on page/layout modules
      if ((key === "page" || key === "layout") && mod.generateMetadata) {
        node.generateMetadata = mod.generateMetadata;
      }

      // Check for auth, roles, permissions, and middlewares exports
      if (key === "page" || key === "layout" || key === "route") {
        if (mod.auth !== undefined) node.auth = mod.auth;
        if (mod.roles !== undefined) node.roles = mod.roles;
        if (mod.permissions !== undefined) node.permissions = mod.permissions;
        if (mod.middlewares !== undefined) node.middlewares = mod.middlewares;
      }
    }
  }

  // Scan subdirectories
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return node;
  }

  const childDirs = entries.filter(
    (e) => e.isDirectory() && !shouldSkipDir(e.name),
  );

  const children: RouteNode[] = [];
  const parallelRoutes: Record<string, RouteNode> = {};

  for (const childDir of childDirs) {
    const childPath = path.join(dir, childDir.name);

    if (childDir.name.startsWith("@")) {
      // Parallel route slot - e.g., @modal
      const slotName = childDir.name.slice(1); // remove @
      parallelRoutes[slotName] = await scanDirectory(
        childPath,
        slotName,
        baseAppDir,
        dynamicImport,
      );
    } else {
      const childSegment = dirNameToSegment(childDir.name);
      children.push(
        await scanDirectory(childPath, childSegment, baseAppDir, dynamicImport),
      );
    }
  }

  // Sort children: static → group → dynamic → catch-all → optional catch-all
  children.sort((a, b) => {
    const orderA = segmentSortOrder(a.segment);
    const orderB = segmentSortOrder(b.segment);
    if (orderA !== orderB) return orderA - orderB;
    return a.segment.localeCompare(b.segment);
  });

  if (children.length > 0) {
    node.children = children;
  }

  if (Object.keys(parallelRoutes).length > 0) {
    node.parallelRoutes = parallelRoutes;
  }

  return node;
}

// ---------------------------------------------------------------------------
// import.meta.glob support (Next.js 16.3 Turbopack)
// ---------------------------------------------------------------------------

/**
 * Converts a Turbopack/Vite `import.meta.glob` result into a RouteNode tree.
 *
 * Usage:
 * const files = import.meta.glob('./app/**\/*.{tsx,ts,jsx,js}', { eager: false });
 * const tree = await globToTree(files, './app');
 */
export async function globToTree(
  globResult: Record<string, () => Promise<any>>,
  baseDir = "./app",
): Promise<RouteNode> {
  const root: RouteNode = { segment: "" };

  debug("veap:Router", `Starting with baseDir: ${baseDir}`);

  for (const [filePath, loader] of Object.entries(globResult)) {
    // Resilient path extraction: find the last occurrence of '/app/' or just 'app/'
    // to handle variations in how Turbopack formats the glob keys.
    const match = filePath.match(/(?:^|\/)app\/(.+)$/);
    if (!match) {
      debug("veap:Router", `Skipping ${filePath} (does not contain /app/)`);
      continue;
    }

    const relativePath = match[1]; // e.g. "products/[id]/page.tsx"
    const parts = relativePath.split("/");
    const fileName = parts.pop() || "";
    const segments = parts;

    // Navigate to or create the node for this path
    let current = root;
    for (const segment of segments) {
      if (segment.startsWith("@")) {
        const slotName = segment.slice(1);
        if (!current.parallelRoutes) current.parallelRoutes = {};
        if (!current.parallelRoutes[slotName]) {
          current.parallelRoutes[slotName] = { segment: slotName };
        }
        current = current.parallelRoutes[slotName];
      } else {
        if (!current.children) current.children = [];
        let child = current.children.find((c) => c.segment === segment);
        if (!child) {
          child = { segment };
          current.children.push(child);
        }
        current = child;
      }
    }

    // Determine the route file type
    const fileBase = fileName.replace(/\.[^/.]+$/, "");
    let key: keyof RouteNode | undefined;
    if (fileBase === "page") key = "page";
    else if (fileBase === "layout") key = "layout";
    else if (fileBase === "loading") key = "loading";
    else if (fileBase === "error") key = "error";
    else if (fileBase === "not-found") key = "notFound";
    else if (fileBase === "default") key = "default";
    else if (fileBase === "route") key = "route";

    if (key) {
      const mod = await loader();
      const exported = mod.default ?? mod;
      (current as any)[key] = exported;

      if ((key === "page" || key === "layout") && mod.generateMetadata) {
        current.generateMetadata = mod.generateMetadata;
      }

      // Check for auth, roles, permissions, and middlewares exports
      if (key === "page" || key === "layout" || key === "route") {
        if (mod.auth !== undefined) current.auth = mod.auth;
        if (mod.roles !== undefined) current.roles = mod.roles;
        if (mod.permissions !== undefined)
          current.permissions = mod.permissions;
        if (mod.middlewares !== undefined)
          current.middlewares = mod.middlewares;
      }
    }
  }

  // Sort children at all levels
  function sortTree(node: RouteNode) {
    if (node.children) {
      node.children.sort((a, b) => {
        const orderA = segmentSortOrder(a.segment);
        const orderB = segmentSortOrder(b.segment);
        if (orderA !== orderB) return orderA - orderB;
        return a.segment.localeCompare(b.segment);
      });
      for (const child of node.children) sortTree(child);
    }
    if (node.parallelRoutes) {
      for (const child of Object.values(node.parallelRoutes)) sortTree(child);
    }
  }
  sortTree(root);

  return root;
}

// ---------------------------------------------------------------------------
// Build-time manifest codegen
// ---------------------------------------------------------------------------

interface ImportEntry {
  name: string;
  path: string;
}

/**
 * Generates a TypeScript source file that exports a fully typed `RouteNode`
 * tree with static imports for every discovered route module.
 *
 * @param appDir       - Absolute path to the `app/` directory
 * @param importPrefix - The import path prefix (e.g., `"./app"`)
 * @returns The generated TypeScript source code
 */
export function generateRouteManifest(
  appDir: string,
  importPrefix: string,
): string {
  const imports: ImportEntry[] = [];
  const tree = scanDirectoryForManifest(appDir, "", importPrefix, imports, []);

  // Build output
  const lines: string[] = [];

  // Import statements
  for (const entry of imports) {
    lines.push(`import ${entry.name} from "${entry.path}";`);
  }

  if (imports.length > 0) {
    lines.push("");
  }

  lines.push(`import type { RouteNode } from "veap/plugins/unstable";`);
  lines.push("");
  lines.push(`export const routeTree: RouteNode = ${tree};`);
  lines.push("");

  return lines.join("\n");
}

/**
 * Recursively scans a directory and produces a string representation of
 * the RouteNode tree literal, collecting import entries along the way.
 */
function scanDirectoryForManifest(
  dir: string,
  segment: string,
  importPrefix: string,
  imports: ImportEntry[],
  pathParts: string[],
): string {
  const props: string[] = [];
  props.push(`segment: ${JSON.stringify(segment)}`);

  // Build a unique suffix for import names based on path
  const nameSuffix =
    pathParts.length === 0
      ? "root"
      : pathParts.map(sanitizeImportName).join("_");

  // Discover route files
  for (const [key, candidates] of Object.entries(ROUTE_FILES)) {
    const filePath = findRouteFile(dir, candidates);
    if (filePath) {
      const fileExt = path.extname(filePath);
      const fileBase = path.basename(filePath, fileExt);
      const relativeParts = [...pathParts, fileBase];
      const importPath = [importPrefix, ...relativeParts].join("/");

      // Build import name: e.g., Page_root, Layout_blog__slug_
      const capitalizedKey = key.charAt(0).toUpperCase() + key.slice(1);
      const importName = `${capitalizedKey}_${nameSuffix}`;

      imports.push({ name: importName, path: importPath });
      props.push(`${key}: ${importName}`);
    }
  }

  // Scan subdirectories
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return `{ ${props.join(", ")} }`;
  }

  const childDirs = entries
    .filter((e) => e.isDirectory() && !shouldSkipDir(e.name))
    .sort((a, b) => {
      const orderA = segmentSortOrder(dirNameToSegment(a.name));
      const orderB = segmentSortOrder(dirNameToSegment(b.name));
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name);
    });

  const childLiterals: string[] = [];
  const parallelLiterals: string[] = [];

  for (const childDir of childDirs) {
    const childPath = path.join(dir, childDir.name);

    if (childDir.name.startsWith("@")) {
      // Parallel slot
      const slotName = childDir.name.slice(1);
      const slotLiteral = scanDirectoryForManifest(
        childPath,
        slotName,
        importPrefix,
        imports,
        [...pathParts, childDir.name],
      );
      parallelLiterals.push(`${JSON.stringify(slotName)}: ${slotLiteral}`);
    } else {
      const childSegment = dirNameToSegment(childDir.name);
      const childLiteral = scanDirectoryForManifest(
        childPath,
        childSegment,
        importPrefix,
        imports,
        [...pathParts, childDir.name],
      );
      childLiterals.push(childLiteral);
    }
  }

  if (childLiterals.length > 0) {
    props.push(`children: [\n    ${childLiterals.join(",\n    ")},\n  ]`);
  }

  if (parallelLiterals.length > 0) {
    props.push(
      `parallelRoutes: {\n    ${parallelLiterals.join(",\n    ")},\n  }`,
    );
  }

  return `{\n  ${props.join(",\n  ")},\n}`;
}
