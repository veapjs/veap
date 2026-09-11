/**
 * @module router
 * @description Public API for the Veap custom router.
 *
 * This module provides an App Router-like routing system for Veap plugins.
 * Routes can be defined as tree structures (RouteNode) or discovered
 * automatically from filesystem conventions.
 */

// --- React Components ---
export { RouterErrorBoundary } from "../presentation/router/react/error-boundary";
export { VeapRouter } from "../presentation/router/react/renderer";
export { withRouter } from "../presentation/router/react/with-router";

// --- API & Middlewares ---
export { handleVeapApiRequest } from "../presentation/router/api/handler";
export {
  EnsuredAuth,
  EnsuredGuest,
  EnsuredUser,
  SkipSecurity,
} from "../presentation/router/api/middlewares";

// --- Engine ---
export type {
  LayoutChainEntry,
  MatchResult,
  RouteNode,
} from "../application/router/route-tree";
export {
  extractParamName,
  isCatchAllSegment,
  isDynamicSegment,
  isGroupSegment,
  isOptionalCatchAllSegment,
  isParallelSlot,
  RouteTree,
  resolveMagicPrefix,
  segmentMatchesUrlPart,
} from "../application/router/route-tree";
export { matchRoute } from "../application/router/matcher";

// --- Discovery ---
export {
  discoverRoutes,
  generateRouteManifest,
  globToTree,
} from "../infrastructure/router/scanner";
export { getPluginsWithHomepage } from "../application/router/discovery";
