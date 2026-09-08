import { ApiEnsuredAuth, runApiPipeline } from "./middlewares";
import type { RouteTree } from "../../../application/router/route-tree";
import { collectApiMiddlewares, collectAuthRequirements } from "./utils";

export async function handleVeapApiRequest(
  request: Request,
  {
    tree,
    path,
    searchParams,
  }: { tree: RouteTree; path: string; searchParams: Record<string, any> },
): Promise<Response> {
  const match = tree.match(path);

  if (!match) {
    return new Response(JSON.stringify({ error: "Not Found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!match.isExact || !match.node.route) {
    return new Response(
      JSON.stringify({ error: "Method Not Allowed or Not Found" }),
      { status: 404, headers: { "Content-Type": "application/json" } },
    );
  }

  const method = request.method;
  const handler =
    match.node.route[method] || match.node.route[method.toLowerCase()];

  if (!handler) {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const allMiddlewares = collectApiMiddlewares(match.layoutChain, match.node);
  const auth = collectAuthRequirements(match.layoutChain, match.node);

  if (auth.needsAuth) {
    allMiddlewares.unshift(ApiEnsuredAuth);
  }

  const context: Record<string, any> = {
    params: match.params,
    searchParams,
    path,
    roles: auth.roles.length > 0 ? auth.roles : undefined,
    permissions: auth.permissions.length > 0 ? auth.permissions : undefined,
  };

  return runApiPipeline(allMiddlewares, request, context, async (req, ctx) => {
    // handler is Next.js standard API handler: (request: Request, context: { params: any, [key: string]: any }) => Response
    // We pass our enriched context to it
    return await handler(req, ctx);
  });
}
