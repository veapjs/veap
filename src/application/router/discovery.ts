import { cache } from "react";
import { app } from "../../infrastructure/ioc/container";
import { RouterService } from "./router.service";
import { matchRoute } from "./matcher";

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
