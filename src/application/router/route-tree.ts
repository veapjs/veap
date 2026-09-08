/**
 * @module route-tree
 * @description Core route tree engine for the Veap unstable custom router.
 *
 * Implements a tree-based routing structure that mirrors Next.js App Router
 * file conventions. Supports static, dynamic, catch-all, optional catch-all,
 * route group, and parallel route segments.
 *
 * @example
 * ```ts
 * const tree = new RouteTree();
 * tree.addTree({
 *   segment: "",
 *   layout: RootLayout,
 *   children: [
 *     { segment: "blog", page: BlogPage, children: [
 *       { segment: "[slug]", page: BlogPostPage },
 *     ]},
 *   ],
 * });
 *
 * const result = tree.match("/blog/hello-world");
 * // result.params => { slug: "hello-world" }
 * ```
 */

import type { UserPermission, UserRole } from "../../domain/auth/types";
import type {
  ApiMiddleware,
  BreadcrumbValue,
  VeapMiddleware,
} from "../../domain/plugins/types";
import type { Metadata } from "next";
import type * as React from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single node in the route tree. Mirrors Next.js App Router file conventions.
 * Each node represents a URL segment and can contain page/layout/loading/error
 * components, metadata generators, middleware pipelines, and auth constraints.
 */
export interface RouteNode {
  /**
   * Segment of the path.
   * - Regular: `"blog"`, `"about"`
   * - Dynamic: `"[id]"`, `"[slug]"`
   * - Catch-all: `"[...path]"`
   * - Optional catch-all: `"[[...path]]"`
   * - Route group: `"(marketing)"` - transparent in URL
   * - Empty string `""` for root/index
   */
  segment: string;

  /** Page component - equivalent to `page.tsx`. */
  page?: React.ComponentType<any>;

  /** Layout wrapping children - equivalent to `layout.tsx`. */
  layout?: React.ComponentType<{
    children: React.ReactNode;
    params?: any;
    [slotName: string]: any;
  }>;

  /** Loading component - equivalent to `loading.tsx`. */
  loading?: React.ComponentType;

  /** Error component - equivalent to `error.tsx` (client component). */
  error?: React.ComponentType<{ error: Error; reset: () => void }>;

  /** Not-found component - equivalent to `not-found.tsx`. */
  notFound?: React.ComponentType;

  /** Default component for parallel route slots - equivalent to `default.tsx`. */
  default?: React.ComponentType<any>;

  /** API route handlers - equivalent to `route.ts`. Contains exported HTTP methods like GET, POST, etc. */
  route?: {
    GET?: Function;
    POST?: Function;
    PUT?: Function;
    DELETE?: Function;
    PATCH?: Function;
    OPTIONS?: Function;
    HEAD?: Function;
    [key: string]: any;
  };

  /**
   * Metadata generator for this route node.
   * Called with params and searchParams to produce `<head>` metadata.
   */
  generateMetadata?: (props: {
    params: Record<string, string>;
    searchParams: Record<string, string>;
  }) => Promise<Metadata> | Metadata;

  /** Middleware pipeline applied when this node is part of the matched chain. */
  middlewares?: (VeapMiddleware | ApiMiddleware)[] | any[];

  /** Whether authentication is required to access this route. */
  auth?: boolean;

  /** Roles required to access this route (RBAC). */
  roles?: UserRole[];

  /** Permissions required to access this route (RBAC). */
  permissions?: UserPermission[];

  /** Breadcrumb configuration for this route node. */
  breadcrumb?: BreadcrumbValue;

  /** Route ID for template overrides and programmatic identification. */
  id?: string;

  /** Child route nodes. */
  children?: RouteNode[];

  /**
   * Parallel route slots: `@slotName` → subtree.
   * Parallel routes are resolved independently against the same URL path.
   */
  parallelRoutes?: Record<string, RouteNode>;
}

/**
 * Represents a single entry in the layout chain collected during route matching.
 * Each entry captures the layout, loading, error, middleware, and auth config
 * from one level of the tree as we walk from root to the matched leaf.
 */
export interface LayoutChainEntry {
  /** Layout component at this level. */
  layout?: React.ComponentType<any>;

  /** Loading component at this level. */
  loading?: React.ComponentType;

  /** Error component at this level. */
  error?: React.ComponentType<{ error: Error; reset: () => void }>;

  /** NotFound component at this level. */
  notFound?: React.ComponentType;

  /** Middleware pipeline at this level. */
  middlewares?: (VeapMiddleware | ApiMiddleware)[] | any[];

  /** Whether authentication is required at this level. */
  auth?: boolean;

  /** Roles required at this level. */
  roles?: UserRole[];

  /** Permissions required at this level. */
  permissions?: UserPermission[];

  /** Resolved parallel slot contents for this layout level. */
  parallelSlots?: Record<string, RouteNode>;

  /** The path segments consumed up to this layout level. Used for parallel route matching. */
  consumedPath?: string;

  /** Route ID for template overrides. */
  id?: string;
}

/**
 * Result of matching a URL path against the route tree.
 */
export interface MatchResult {
  /** The matched leaf node (has a `page` component). */
  node: RouteNode;

  /** Extracted URL parameters (dynamic segments, catch-all, etc.). */
  params: Record<string, string>;

  /** Chain of layouts from root to the matched node. */
  layoutChain: LayoutChainEntry[];

  /** Path segments that were matched (for debugging/breadcrumbs). */
  matchedSegments: string[];

  /** True if the path was fully consumed and matched a leaf node (page). False for partial matches. */
  isExact: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Segment classification helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Checks if a segment is a route group (e.g., `"(marketing)"`).
 * Route groups are transparent in URL matching - they organize the tree
 * without affecting the URL structure.
 */
export function isGroupSegment(segment: string): boolean {
  return /^\(.+\)$/.test(segment);
}

/**
 * Checks if a segment is a dynamic parameter (e.g., `"[id]"`).
 * Dynamic segments match exactly one URL segment and extract a named parameter.
 */
export function isDynamicSegment(segment: string): boolean {
  return /^\[[^[\].]+\]$/.test(segment);
}

/**
 * Checks if a segment is a catch-all parameter (e.g., `"[...path]"`).
 * Catch-all segments match one or more remaining URL segments.
 */
export function isCatchAllSegment(segment: string): boolean {
  return /^\[\.\.\..+\]$/.test(segment);
}

/**
 * Checks if a segment is an optional catch-all parameter (e.g., `"[[...path]]"`).
 * Optional catch-all segments match zero or more remaining URL segments.
 */
export function isOptionalCatchAllSegment(segment: string): boolean {
  return /^\[\[\.\.\..+\]\]$/.test(segment);
}

/**
 * Checks if a segment is a parallel route slot (e.g., `"@modal"`).
 * Parallel routes are not part of URL matching - they are resolved
 * independently against the same remaining path segments.
 */
export function isParallelSlot(segment: string): boolean {
  return /^@.+$/.test(segment);
}

/**
 * Extracts the parameter name from a dynamic, catch-all, or optional catch-all segment.
 *
 * @example
 * ```ts
 * extractParamName("[id]")         // => "id"
 * extractParamName("[...path]")    // => "path"
 * extractParamName("[[...slug]]")  // => "slug"
 * ```
 */
export function extractParamName(segment: string): string {
  if (isOptionalCatchAllSegment(segment)) {
    // [[...name]] -> name
    return segment.slice(5, -2);
  }
  if (isCatchAllSegment(segment)) {
    // [...name] -> name
    return segment.slice(4, -1);
  }
  if (isDynamicSegment(segment)) {
    // [name] -> name
    return segment.slice(1, -1);
  }
  return segment;
}

/**
 * Checks if a route tree segment definition matches a concrete URL part.
 *
 * - Static segments must match exactly (case-sensitive).
 * - Dynamic `[param]` segments match any single non-empty URL part.
 * - Group segments `(name)` never directly match a URL part (they are transparent).
 * - Catch-all and optional catch-all are handled separately in the matching algorithm.
 */
export function segmentMatchesUrlPart(
  segment: string,
  urlPart: string,
): boolean {
  // Group segments are transparent - they don't consume URL parts
  if (isGroupSegment(segment)) {
    return false;
  }
  // Dynamic segments match any single non-empty URL part
  if (isDynamicSegment(segment)) {
    return urlPart.length > 0;
  }
  // Catch-all and optional catch-all are not handled here
  // (they require special multi-segment logic)
  if (isCatchAllSegment(segment) || isOptionalCatchAllSegment(segment)) {
    return false;
  }
  // Static segment: exact match
  return segment === urlPart;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates an empty root RouteNode.
 */
function createRootNode(): RouteNode {
  return { segment: "", children: [] };
}

/**
 * Builds a {@link LayoutChainEntry} from a given {@link RouteNode}.
 */
function buildChainEntry(
  node: RouteNode,
  consumedSegments: string[],
): LayoutChainEntry {
  const entry: LayoutChainEntry = {};

  if (node.layout) entry.layout = node.layout;
  if (node.loading) entry.loading = node.loading;
  if (node.error) entry.error = node.error;
  if (node.notFound) entry.notFound = node.notFound;
  if (node.middlewares?.length) entry.middlewares = node.middlewares;
  if (node.id !== undefined) entry.id = node.id;
  if (node.auth !== undefined) entry.auth = node.auth;
  if (node.roles?.length) entry.roles = node.roles;
  if (node.permissions?.length) entry.permissions = node.permissions;
  if (node.parallelRoutes && Object.keys(node.parallelRoutes).length > 0) {
    entry.parallelSlots = node.parallelRoutes;
  }

  entry.consumedPath = consumedSegments.join("/");

  return entry;
}

/**
 * Normalizes a URL path into an array of non-empty segments.
 *
 * @example
 * ```ts
 * splitPath("/")           // => []
 * splitPath("/blog/hello") // => ["blog", "hello"]
 * splitPath("/a//b/")      // => ["a", "b"]
 * ```
 */
function splitPath(path: string): string[] {
  return path.split("/").filter((s) => s.length > 0);
}

/**
 * Finds or creates a child node with the given segment in `parent.children`.
 */
function ensureChild(parent: RouteNode, segment: string): RouteNode {
  if (!parent.children) {
    parent.children = [];
  }

  const existing = parent.children.find((c) => c.segment === segment);
  if (existing) {
    return existing;
  }

  const child: RouteNode = { segment, children: [] };
  parent.children.push(child);
  return child;
}

// ─────────────────────────────────────────────────────────────────────────────
// Recursive matching
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Internal result type used during recursive matching.
 */
interface InternalMatchResult {
  node: RouteNode;
  params: Record<string, string>;
  layoutChain: LayoutChainEntry[];
  matchedSegments: string[];
}

/**
 * Recursively attempts to match `remainingSegments` against the children
 * of the given `node`.
 *
 * The algorithm follows Next.js App Router priority:
 * 1. Static children (exact string match)
 * 2. Dynamic `[param]` children
 * 3. Catch-all `[...param]` children
 * 4. Optional catch-all `[[...param]]` children
 *
 * Route groups `(name)` are transparent: their children participate in
 * matching as if they were direct children of the parent, but the group's
 * layout/middleware/auth are still applied in the chain.
 */
function matchRecursive(
  node: RouteNode,
  remainingSegments: string[],
  currentParams: Record<string, string>,
  currentChain: LayoutChainEntry[],
  currentMatched: string[],
  bestPartialMatch?: { depth: number; result: InternalMatchResult | null },
): InternalMatchResult | null {
  if (bestPartialMatch && currentMatched.length > bestPartialMatch.depth) {
    bestPartialMatch.depth = currentMatched.length;
    bestPartialMatch.result = {
      node,
      params: { ...currentParams },
      layoutChain: [...currentChain],
      matchedSegments: [...currentMatched],
    };
  }

  const children = node.children ?? [];

  // ── Base case: all segments consumed ──────────────────────────────────
  if (remainingSegments.length === 0) {
    // Check if this node itself has a page (index route) or a route (API route)
    if (node.page || node.route) {
      return {
        node,
        params: { ...currentParams },
        layoutChain: [...currentChain],
        matchedSegments: [...currentMatched],
      };
    }

    // Check for an index child (segment === "")
    for (const child of children) {
      if (child.segment === "" && (child.page || child.route)) {
        const entry = buildChainEntry(child, currentMatched);
        return {
          node: child,
          params: { ...currentParams },
          layoutChain: [...currentChain, entry],
          matchedSegments: [...currentMatched],
        };
      }
    }

    // Check route group children - they might contain index pages
    for (const child of children) {
      if (isGroupSegment(child.segment)) {
        const groupEntry = buildChainEntry(child, currentMatched);
        const groupResult = matchRecursive(
          child,
          [],
          currentParams,
          [...currentChain, groupEntry],
          currentMatched,
          bestPartialMatch,
        );
        if (groupResult) return groupResult;
      }
    }

    // Check optional catch-all children (they can match zero segments)
    for (const child of children) {
      if (
        isOptionalCatchAllSegment(child.segment) &&
        (child.page || child.route)
      ) {
        const paramName = extractParamName(child.segment);
        const entry = buildChainEntry(child, currentMatched);
        return {
          node: child,
          params: { ...currentParams, [paramName]: "" },
          layoutChain: [...currentChain, entry],
          matchedSegments: [...currentMatched],
        };
      }
    }

    return null;
  }

  const [currentSegment, ...rest] = remainingSegments;

  // ── 1. Static children (exact match) ──────────────────────────────────
  for (const child of children) {
    if (
      !isGroupSegment(child.segment) &&
      !isDynamicSegment(child.segment) &&
      !isCatchAllSegment(child.segment) &&
      !isOptionalCatchAllSegment(child.segment) &&
      child.segment === currentSegment
    ) {
      const entry = buildChainEntry(child, [...currentMatched, currentSegment]);
      const result = matchRecursive(
        child,
        rest,
        currentParams,
        [...currentChain, entry],
        [...currentMatched, currentSegment],
        bestPartialMatch,
      );
      if (result) return result;
    }
  }

  // ── 1b. Route groups (transparent, try their children) ────────────────
  for (const child of children) {
    if (isGroupSegment(child.segment)) {
      const groupEntry = buildChainEntry(child, currentMatched);
      const result = matchRecursive(
        child,
        remainingSegments, // Don't consume a segment - groups are transparent
        currentParams,
        [...currentChain, groupEntry],
        currentMatched,
        bestPartialMatch,
      );
      if (result) return result;
    }
  }

  // ── 2. Dynamic `[param]` children ─────────────────────────────────────
  for (const child of children) {
    if (isDynamicSegment(child.segment)) {
      const paramName = extractParamName(child.segment);
      const entry = buildChainEntry(child, [...currentMatched, currentSegment]);
      const result = matchRecursive(
        child,
        rest,
        { ...currentParams, [paramName]: currentSegment },
        [...currentChain, entry],
        [...currentMatched, currentSegment],
        bestPartialMatch,
      );
      if (result) return result;
    }
  }

  // ── 3. Catch-all `[...param]` children (1+ segments) ─────────────────
  for (const child of children) {
    if (isCatchAllSegment(child.segment) && (child.page || child.route)) {
      const paramName = extractParamName(child.segment);
      const caughtSegments = remainingSegments;
      const entry = buildChainEntry(child, [
        ...currentMatched,
        ...caughtSegments,
      ]);
      return {
        node: child,
        params: {
          ...currentParams,
          [paramName]: caughtSegments.join("/"),
        },
        layoutChain: [...currentChain, entry],
        matchedSegments: [...currentMatched, ...caughtSegments],
      };
    }
  }

  // ── 4. Optional catch-all `[[...param]]` children (0+ segments) ──────
  for (const child of children) {
    if (
      isOptionalCatchAllSegment(child.segment) &&
      (child.page || child.route)
    ) {
      const paramName = extractParamName(child.segment);
      const caughtSegments = remainingSegments;
      const entry = buildChainEntry(child, [
        ...currentMatched,
        ...caughtSegments,
      ]);
      return {
        node: child,
        params: {
          ...currentParams,
          [paramName]: caughtSegments.join("/"),
        },
        layoutChain: [...currentChain, entry],
        matchedSegments: [...currentMatched, ...caughtSegments],
      };
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// RouteTree class
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A tree-based route structure that mirrors Next.js App Router conventions.
 *
 * The `RouteTree` class manages the entire route hierarchy, supporting:
 * - Adding subtrees at arbitrary path prefixes
 * - Merging trees from multiple plugins
 * - Matching URL paths with priority-based segment resolution
 * - Collecting the layout/middleware chain for the matched route
 * - Generating metadata for matched routes
 *
 * @example
 * ```ts
 * const tree = new RouteTree();
 *
 * // Add plugin routes
 * tree.addTree({
 *   segment: "",
 *   page: DashboardPage,
 *   layout: DashboardLayout,
 *   children: [
 *     { segment: "settings", page: SettingsPage },
 *     { segment: "users", page: UsersPage, children: [
 *       { segment: "[id]", page: UserDetailPage },
 *     ]},
 *   ],
 * });
 *
 * // Match a path
 * const match = tree.match("/users/42");
 * // match.params => { id: "42" }
 * // match.layoutChain => [rootEntry, usersEntry, userDetailEntry]
 * ```
 */
/**
 * Creates a shallow clone of a RouteNode, preserving component references (functions),
 * while recursively cloning the children and parallelRoutes structures.
 */
function cloneNode(node: RouteNode): RouteNode {
  const clone: RouteNode = { ...node };

  if (node.children) {
    clone.children = node.children.map(cloneNode);
  }

  if (node.parallelRoutes) {
    clone.parallelRoutes = {};
    for (const [slot, slotTree] of Object.entries(node.parallelRoutes)) {
      clone.parallelRoutes[slot] = cloneNode(slotTree);
    }
  }

  return clone;
}

/**
 * Replaces any dynamically named `[prefix]` segments in the route tree
 * with the actual static prefix path.
 *
 * If the prefix path is empty (e.g., "/"), it replaces `[prefix]` with `(prefix)`
 * to act as a route group (so layouts/middlewares still apply but path is unaffected).
 * If the prefix contains multiple segments (e.g., "admin/dashboard"), it builds
 * a chain of nodes, placing the original node's properties on the innermost segment.
 */
export function resolveMagicPrefix(
  node: RouteNode,
  prefixPath: string,
): RouteNode {
  const clone: RouteNode = { ...node };

  if (clone.children) {
    clone.children = clone.children.flatMap((child) => {
      if (child.segment === "[prefix]") {
        const segments = prefixPath.split("/").filter(Boolean);

        // Resolve children recursively first
        const resolvedChild = resolveMagicPrefix(child, prefixPath);

        if (segments.length === 0) {
          // Treat as a group so it doesn't affect URL
          resolvedChild.segment = "(prefix)";
          return [resolvedChild];
        } else {
          resolvedChild.segment = segments[segments.length - 1];

          // If there are multiple prefix segments, wrap them
          let current = resolvedChild;
          for (let i = segments.length - 2; i >= 0; i--) {
            current = { segment: segments[i], children: [current] };
          }
          return [current];
        }
      } else {
        return [resolveMagicPrefix(child, prefixPath)];
      }
    });
  }

  if (clone.parallelRoutes) {
    clone.parallelRoutes = {};
    for (const [slot, slotTree] of Object.entries(node.parallelRoutes!)) {
      clone.parallelRoutes[slot] = resolveMagicPrefix(slotTree, prefixPath);
    }
  }

  return clone;
}

export class RouteTree {
  /** @internal The root node of the route tree. */
  private root: RouteNode;

  /**
   * @param initialRoot - Optional root node to initialize the tree with.
   *                      When provided, the tree is built from this node.
   *                      When omitted, an empty root node is created.
   */
  constructor(initialRoot?: RouteNode) {
    this.root = initialRoot ? cloneNode(initialRoot) : createRootNode();
  }

  /**
   * Returns the root node of the route tree.
   * Useful for inspection, serialization, or debugging.
   */
  getRoot(): RouteNode {
    return this.root;
  }

  /**
   * Adds a subtree to this route tree, optionally mounting it at a specific
   * prefix path.
   *
   * @param source - The subtree to add (RouteNode or RouteTree instance).
   * @param prefix - Optional path prefix (e.g., `"/admin"`).
   */
  addTree(source: RouteNode | RouteTree, prefix?: string): void {
    const treeNode = source instanceof RouteTree ? source.getRoot() : source;

    if (!prefix || prefix === "/") {
      this.mergeNode(this.root, treeNode);
      return;
    }

    const segments = splitPath(prefix);
    let current = this.root;

    for (const seg of segments) {
      current = ensureChild(current, seg);
    }

    this.mergeNode(current, treeNode);
  }

  /**
   * Deep-merges `source` into `target`, combining children, parallel routes,
   * and all other node properties.
   *
   * Merge semantics:
   * - Scalar properties from `source` override `target` if defined.
   * - `children` arrays are merged by segment name (recursive merge).
   * - `parallelRoutes` maps are merged by slot name (recursive merge).
   * - `middlewares` arrays are concatenated.
   * - `roles` and `permissions` arrays are deduplicated and merged.
   *
   * @param target - The target node to merge into (mutated in place).
   * @param source - The source node to merge from.
   */
  mergeNode(target: RouteNode, source: RouteNode): void {
    // Merge scalar/component properties (source wins if defined)
    if (source.page) target.page = source.page;
    if (source.layout) target.layout = source.layout;
    if (source.loading) target.loading = source.loading;
    if (source.error) target.error = source.error;
    if (source.notFound) target.notFound = source.notFound;
    if (source.default) target.default = source.default;
    if (source.route) target.route = source.route;
    if (source.generateMetadata)
      target.generateMetadata = source.generateMetadata;
    if (source.breadcrumb !== undefined) target.breadcrumb = source.breadcrumb;
    if (source.id !== undefined) target.id = source.id;
    if (source.auth !== undefined) target.auth = source.auth;

    // Merge middleware arrays (concatenate)
    if (source.middlewares?.length) {
      target.middlewares = [
        ...(target.middlewares ?? []),
        ...source.middlewares,
      ];
    }

    // Merge roles (deduplicate)
    if (source.roles?.length) {
      const existing = new Set(target.roles ?? []);
      for (const role of source.roles) existing.add(role);
      target.roles = [...existing];
    }

    // Merge permissions (deduplicate)
    if (source.permissions?.length) {
      const existing = new Set(target.permissions ?? []);
      for (const perm of source.permissions) existing.add(perm);
      target.permissions = [...existing];
    }

    // Merge children by segment
    if (source.children?.length) {
      if (!target.children) target.children = [];

      for (const sourceChild of source.children) {
        const existingChild = target.children.find(
          (c) => c.segment === sourceChild.segment,
        );
        if (existingChild) {
          this.mergeNode(existingChild, sourceChild);
        } else {
          target.children.push(cloneNode(sourceChild));
        }
      }
    }

    // Merge parallel routes by slot name
    if (source.parallelRoutes) {
      if (!target.parallelRoutes) target.parallelRoutes = {};

      for (const [slotName, slotTree] of Object.entries(
        source.parallelRoutes,
      )) {
        if (target.parallelRoutes[slotName]) {
          this.mergeNode(target.parallelRoutes[slotName], slotTree);
        } else {
          target.parallelRoutes[slotName] = cloneNode(slotTree);
        }
      }
    }
  }

  /**
   * Matches a URL path against the route tree.
   *
   * The matching algorithm:
   * 1. Splits the path into segments.
   * 2. Walks the tree from the root, collecting the layout chain.
   * 3. At each level, tries children in priority order:
   *    static → route group → dynamic → catch-all → optional catch-all.
   * 4. A match is found when a node with a `page` component is reached
   *    and all segments are consumed (or caught by a catch-all).
   *
   * @param path - The URL path to match (e.g., `"/blog/hello"`).
   * @returns The match result, or `null` if no route matches.
   */
  match(path: string): MatchResult | null {
    const segments = splitPath(path);

    // Start with root's chain entry
    const rootEntry = buildChainEntry(this.root, []);

    const bestPartialMatch = {
      depth: -1,
      result: null as InternalMatchResult | null,
    };

    const result = matchRecursive(
      this.root,
      segments,
      {},
      [rootEntry],
      [],
      bestPartialMatch,
    );

    if (result) {
      return {
        node: result.node,
        params: result.params,
        layoutChain: result.layoutChain,
        matchedSegments: result.matchedSegments,
        isExact: true,
      };
    }

    if (bestPartialMatch.result) {
      return {
        node: bestPartialMatch.result.node,
        params: bestPartialMatch.result.params,
        layoutChain: bestPartialMatch.result.layoutChain,
        matchedSegments: bestPartialMatch.result.matchedSegments,
        isExact: false,
      };
    }

    return null;
  }

  /**
   * Generates metadata for a matched route path.
   *
   * Walks the layout chain from root to the matched leaf and collects metadata
   * from each level's `generateMetadata` function, merging them together.
   * Leaf-level metadata takes precedence over parent metadata for conflicting keys.
   *
   * @param path - The URL path to generate metadata for.
   * @param searchParams - Optional search params from the URL query string.
   * @returns The merged metadata object, or an empty object if no route matches.
   */
  async generateMetadata(
    path: string,
    searchParams: Record<string, string> = {},
  ): Promise<Metadata> {
    const matchResult = this.match(path);
    if (!matchResult) return {};

    const { params, node } = matchResult;
    let mergedMetadata: Metadata = {};

    // Walk the layout chain to find nodes with generateMetadata
    // We need to re-walk the tree to access the actual nodes (chain entries
    // don't store generateMetadata). For now, use the leaf node's generator.
    // A full implementation would walk the tree and call generators at each level.

    // Collect metadata generators from the matched path
    const generators = this.collectMetadataGenerators(path);

    for (const generator of generators) {
      const metadata = await generator({ params, searchParams });
      mergedMetadata = { ...mergedMetadata, ...metadata };
    }

    // Also check the leaf node
    if (node.generateMetadata) {
      const leafMetadata = await node.generateMetadata({
        params,
        searchParams,
      });
      mergedMetadata = { ...mergedMetadata, ...leafMetadata };
    }

    return mergedMetadata;
  }

  /**
   * Collects all `generateMetadata` functions along the matched path.
   * @internal
   */
  private collectMetadataGenerators(
    path: string,
  ): Array<
    (props: {
      params: Record<string, string>;
      searchParams: Record<string, string>;
    }) => Promise<Metadata> | Metadata
  > {
    const segments = splitPath(path);
    const generators: Array<
      (props: {
        params: Record<string, string>;
        searchParams: Record<string, string>;
      }) => Promise<Metadata> | Metadata
    > = [];

    // Collect from root
    if (this.root.generateMetadata) {
      generators.push(this.root.generateMetadata);
    }

    this.collectGeneratorsRecursive(this.root, segments, generators);

    return generators;
  }

  /**
   * Recursively walks the tree to collect metadata generators.
   * @internal
   */
  private collectGeneratorsRecursive(
    node: RouteNode,
    remainingSegments: string[],
    generators: Array<
      (props: {
        params: Record<string, string>;
        searchParams: Record<string, string>;
      }) => Promise<Metadata> | Metadata
    >,
  ): boolean {
    const children = node.children ?? [];

    if (remainingSegments.length === 0) {
      // Check index child
      for (const child of children) {
        if (child.segment === "" && child.page) {
          if (child.generateMetadata) generators.push(child.generateMetadata);
          return true;
        }
      }
      // Check if node itself has a page
      return !!node.page;
    }

    const [currentSegment, ...rest] = remainingSegments;

    // Static children
    for (const child of children) {
      if (
        !isGroupSegment(child.segment) &&
        !isDynamicSegment(child.segment) &&
        !isCatchAllSegment(child.segment) &&
        !isOptionalCatchAllSegment(child.segment) &&
        child.segment === currentSegment
      ) {
        if (child.generateMetadata) generators.push(child.generateMetadata);
        if (this.collectGeneratorsRecursive(child, rest, generators))
          return true;
        // Backtrack: remove the generator we just added if it didn't lead to a match
        if (child.generateMetadata) generators.pop();
      }
    }

    // Route groups
    for (const child of children) {
      if (isGroupSegment(child.segment)) {
        if (child.generateMetadata) generators.push(child.generateMetadata);
        if (
          this.collectGeneratorsRecursive(child, remainingSegments, generators)
        )
          return true;
        if (child.generateMetadata) generators.pop();
      }
    }

    // Dynamic segments
    for (const child of children) {
      if (isDynamicSegment(child.segment)) {
        if (child.generateMetadata) generators.push(child.generateMetadata);
        if (this.collectGeneratorsRecursive(child, rest, generators))
          return true;
        if (child.generateMetadata) generators.pop();
      }
    }

    // Catch-all
    for (const child of children) {
      if (isCatchAllSegment(child.segment) && child.page) {
        if (child.generateMetadata) generators.push(child.generateMetadata);
        return true;
      }
    }

    // Optional catch-all
    for (const child of children) {
      if (isOptionalCatchAllSegment(child.segment) && child.page) {
        if (child.generateMetadata) generators.push(child.generateMetadata);
        return true;
      }
    }

    return false;
  }
}
