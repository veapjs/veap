import * as React from "react";
import { eventBus } from "../../../application/events/event-bus";
import type {
  MatchResult,
  RouteNode,
  RouteTree,
} from "../../../application/router/route-tree";
import { AppError } from "../../../domain/errors/app-error";
import type { VeapMiddlewareContext } from "../../../domain/plugins/types";
import { warn } from "../../../infrastructure/logging";
import { EnsuredAuth, runPipeline, SkipSecurity } from "../api/middlewares";
import { collectAuthRequirements, collectMiddlewares } from "../api/utils";
import { RouterErrorBoundary } from "./error-boundary";
import { SoftNavigationInterceptor } from "./soft-navigation";

// ---------------------------------------------------------------------------
// Parallel slot resolution
// ---------------------------------------------------------------------------

/**
 * Resolves a single parallel slot by matching the current path against
 * the slot's subtree. Falls back to the slot's `default` export if no
 * match is found, or `null` if neither is available.
 */
async function resolveParallelSlot(
  slotTree: RouteNode,
  path: string,
  searchParams: Record<string, any>,
  params: Record<string, string>,
  _slotName: string,
  context: VeapMiddlewareContext,
): Promise<React.ReactNode> {
  const { RouteTree: RouteTreeClass } = await import(
    "../../../application/router/route-tree"
  );
  const tempTree = new RouteTreeClass(slotTree);
  const slotMatch = tempTree.match(path);

  if (slotMatch?.node.page) {
    const SlotPage = slotMatch.node.page;
    const mergedParams = { ...params, ...slotMatch.params };
    return (
      <SlotPage
        params={mergedParams}
        searchParams={searchParams}
        context={context}
      />
    );
  }

  // No match - try the `default` export (acts as a fallback like Next.js)
  if (slotTree.default) {
    const DefaultComponent = slotTree.default;
    return (
      <DefaultComponent
        params={params}
        searchParams={searchParams}
        context={context}
      />
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Parallel slots resolver (all slots for a layout entry)
// ---------------------------------------------------------------------------

async function resolveAllParallelSlots(
  parallelSlots: Record<string, RouteNode> | undefined,
  path: string,
  searchParams: Record<string, any>,
  params: Record<string, string>,
  context: VeapMiddlewareContext,
): Promise<Record<string, React.ReactNode>> {
  if (!parallelSlots || Object.keys(parallelSlots).length === 0) {
    return {};
  }

  const entries = await Promise.all(
    Object.entries(parallelSlots).map(async ([slotName, slotNode]) => {
      const rendered = await resolveParallelSlot(
        slotNode,
        path,
        searchParams,
        params,
        slotName,
        context,
      );
      return [slotName, rendered] as const;
    }),
  );

  const result: Record<string, React.ReactNode> = {};
  for (const [name, node] of entries) {
    result[name] = node;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Main renderer
// ---------------------------------------------------------------------------

/**
 * Async Server Component that performs route matching, middleware execution,
 * and nested layout rendering for the Veap router.
 */
export async function VeapRouter({
  tree,
  path,
  searchParams,
  CustomPageComponent,
  customConfig,
}: {
  tree: RouteTree;
  path: string;
  searchParams: Record<string, any>;
  CustomPageComponent?: React.ComponentType<any>;
  customConfig?: {
    roles?: string[];
    permissions?: string[];
    middlewares?: any[];
  };
}): Promise<React.ReactNode> {
  // 1. Match the incoming path against the route tree
  const match = tree.match(path);

  if (process.env.NODE_ENV !== "production") {
    eventBus
      .publish("router:request", {
        path,
        searchParams,
        params: match?.params || {},
        matchedNode: match?.node?.segment || "/",
        timestamp: Date.now(),
      })
      .catch(() => {});
  }

  if (!match) {
    warn("veap:Router", "[renderer] match should never be null");
    throw AppError.Internal(
      `[VeapRouter] Invariant failed: match should never be null`,
    );
  }

  // 2. Collect middlewares (outermost-first order, since layoutChain is already outermost-first)
  const allMiddlewares = collectMiddlewares(match.layoutChain, match.node);

  // 3. Collect auth requirements from entire chain + matched node
  const auth = collectAuthRequirements(match.layoutChain, match.node);

  // --- Inject Custom Physical Page Config ---
  if (customConfig) {
    if (customConfig.roles?.length) {
      auth.roles.push(...customConfig.roles);
      auth.needsAuth = true;
    }
    if (customConfig.permissions?.length) {
      auth.permissions.push(...customConfig.permissions);
      auth.needsAuth = true;
    }
    if (customConfig.middlewares?.length) {
      allMiddlewares.push(...customConfig.middlewares);
    }
  }

  // 4. Prepend EnsuredAuth if any auth requirements exist - unless the route
  //    explicitly opted out with SkipSecurity (marker middleware). This lets
  //    gate pages (onboarding, 2FA setup, ...) live under a protected layout
  //    without their own security requirement redirecting onto themselves.
  if (auth.needsAuth && !allMiddlewares.includes(SkipSecurity)) {
    allMiddlewares.unshift(EnsuredAuth);
  }

  // 5. Build the middleware context
  const context: VeapMiddlewareContext = {
    params: match.params,
    searchParams,
    path,
    roles: auth.roles.length > 0 ? auth.roles : undefined,
    permissions: auth.permissions.length > 0 ? auth.permissions : undefined,
  };

  // 6. Run the middleware pipeline. The final callback builds the layout tree.
  return runPipeline(allMiddlewares, context, async (ctx) => {
    return buildLayoutTree(match, searchParams, path, ctx, CustomPageComponent);
  });
}

// ---------------------------------------------------------------------------
// Layout tree builder
// ---------------------------------------------------------------------------

/**
 * Constructs the nested layout tree from innermost page outward through
 * the layout chain, wrapping with error boundaries and suspense as needed.
 */
async function buildLayoutTree(
  match: MatchResult,
  searchParams: Record<string, any>,
  path: string,
  context: VeapMiddlewareContext,
  CustomPageComponent?: React.ComponentType<any>,
): Promise<React.ReactNode> {
  const { node, params, layoutChain } = match;

  const { getPluginBreadcrumbs: getBreadcrumbs } = await import(
    "../../../application/plugins/breadcrumbs"
  );

  const breadcrumbs = await getBreadcrumbs(path, searchParams);

  // Start with the page component at the innermost level
  let content: React.ReactNode;

  // Use CustomPageComponent if provided (from withRouter), otherwise use matched node.page
  if (CustomPageComponent) {
    content = (
      <CustomPageComponent
        params={params}
        searchParams={searchParams}
        breadcrumbs={breadcrumbs}
        context={context}
      />
    );
  } else if (match.isExact && node.page) {
    const Page = node.page;
    content = (
      <Page
        params={params}
        searchParams={searchParams}
        breadcrumbs={breadcrumbs}
        context={context}
      />
    );
  } else {
    // For partial matches (404), or exact matches with no page component, we look for a notFound component.
    // Try the innermost node first
    let NotFound = node.notFound;

    // If not found, walk up the layout chain to find the nearest notFound
    if (!NotFound) {
      for (let i = layoutChain.length - 1; i >= 0; i--) {
        if (layoutChain[i].notFound) {
          NotFound = layoutChain[i].notFound;
          break;
        }
      }
    }

    if (NotFound) {
      content = <NotFound />;
    } else {
      content = (
        <div
          role="alert"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "50vh",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <h1
              style={{ fontSize: "3rem", fontWeight: 700, margin: "0 0 1rem" }}
            >
              404
            </h1>
            <p style={{ fontSize: "1.125rem", color: "#6b7280" }}>
              Page not found:{" "}
              <code
                style={{
                  padding: "0.125rem 0.375rem",
                  borderRadius: "0.25rem",
                  backgroundColor: "#f3f4f6",
                  fontSize: "0.875rem",
                }}
              >
                {path}
              </code>
            </p>
          </div>
        </div>
      );
    }
  }

  // Wrap with node-level error boundary if present
  if (node.error) {
    content = <RouterErrorBoundary>{content}</RouterErrorBoundary>;
  }

  // Walk the layout chain from INNERMOST to OUTERMOST
  const reversedChain = [...layoutChain].reverse();

  for (const entry of reversedChain) {
    // Error boundary wrapping
    if (entry.error) {
      content = (
        <RouterErrorBoundary
          key={`error-${entry.consumedPath || entry.id || "root"}`}
        >
          {content}
        </RouterErrorBoundary>
      );
    }

    // Loading wrapping (Suspense)
    if (entry.loading) {
      const Loading = entry.loading;
      content = (
        <React.Suspense
          key={`suspense-${entry.consumedPath || entry.id || "root"}`}
          fallback={<Loading />}
        >
          {content}
        </React.Suspense>
      );
    }

    // Layout wrapping
    if (entry.layout) {
      const Layout = entry.layout;

      // Resolve parallel slots if present
      // The slot needs to match against the *remaining* path segments after this layout
      const consumedCount = entry.consumedPath
        ? entry.consumedPath.split("/").filter(Boolean).length
        : 0;
      const remainingSegments = match.matchedSegments.slice(consumedCount);
      const remainingPath = remainingSegments.join("/") || "/";

      const resolvedSlots = await resolveAllParallelSlots(
        entry.parallelSlots,
        remainingPath,
        searchParams,
        params,
        context,
      );

      content = (
        <Layout params={params} context={context} {...resolvedSlots}>
          {content}
        </Layout>
      );
    }
  }

  return <SoftNavigationInterceptor>{content}</SoftNavigationInterceptor>;
}
