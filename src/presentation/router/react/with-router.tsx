import * as React from "react";
import { headers } from "next/headers";
import { buildRouteTree } from "../../../application/router/discovery";
import { VeapRouter } from "./renderer";

/**
 * A Higher-Order Component (HOC) that wraps a physical Next.js page component
 * with the Veap Virtual Router. This allows physical pages to inherit virtual layouts,
 * parallel slots (like @sidebar), and middleware protection from plugins.
 *
 * @example
 * ```tsx
 * import { withRouter } from "@veap/framework/router";
 *
 * export default withRouter(async function CustomPage() {
 *    return <div>My Custom Physical Page</div>;
 * }, "/app/custom");
 * ```
 */
export interface WithRouterConfig {
  path?: string;
  roles?: string[];
  permissions?: string[];
  middlewares?: any[];
}

export function withRouter(
  Component: React.ComponentType<any>,
  configOrPath?: WithRouterConfig | string,
) {
  return async function WrappedPage(props: any) {
    const searchParams = (await props.searchParams) || {};

    const config: WithRouterConfig =
      typeof configOrPath === "string"
        ? { path: configOrPath }
        : configOrPath || {};

    let routePath = config.path;

    if (!routePath) {
      // Attempt to infer the path from Next.js internal headers
      const headersList = await headers();
      routePath = headersList.get("x-invoke-path") || "/";
    }

    // Build the virtual route tree
    const tree = await buildRouteTree(true);

    // Run the VeapRouter but inject the physical Component as the leaf node
    return (
      <VeapRouter
        tree={tree}
        path={routePath}
        searchParams={searchParams}
        CustomPageComponent={Component}
        customConfig={config}
      />
    );
  };
}
