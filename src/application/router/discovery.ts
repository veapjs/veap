import { cache } from "react";
import { app } from "../../infrastructure/ioc/container";
import { matchRoute } from "./matcher";
import { RouterService } from "./router.service";

export { matchRoute };

export async function getPluginsWithHomepage(): Promise<
  { id: string; name: string }[]
> {
  return (await app(RouterService)).getPluginsWithHomepage();
}

/**
 * Builds a unified `RouteTree` from all enabled plugins.
 *
 * All trees are merged into a single `RouteTree` instance that can be
 * passed to the `VeapRouter` component.
 *
 * @param includePrivate - If true, includes private routes prefixed with the configured privatePath.
 * @returns A fully merged `RouteTree` instance.
 */
export const buildRouteTree = cache(async (includePrivate: boolean = false) => {
  return (await app(RouterService)).buildRouteTree(includePrivate);
});

/**
 * Registers an internal route rewrite rule in RouterService.
 *
 * @param from - Incoming public path (e.g. "/logowanie")
 * @param to - Target virtual path (e.g. "/signin")
 */
export async function addRouteRewrite(from: string, to: string): Promise<void> {
  const router = await app(RouterService);
  router.addRewrite(from, to);
}

/**
 * Returns all registered route rewrites.
 */
export async function getRouteRewrites(): Promise<Map<string, string>> {
  const router = await app(RouterService);
  return router.getRewrites();
}
