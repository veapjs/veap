import { checkSecurity } from "../../../application/auth/logic";
import { getCurrentSession } from "../../../application/auth/facades/session";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type {
  ApiMiddleware,
  VeapMiddleware,
  VeapMiddlewareContext,
} from "../../../domain/plugins/types";

export const EnsuredGuest: VeapMiddleware = async (ctx, next) => {
  const { user, session } = await getCurrentSession();

  if (user && session) {
    const headersList = await headers();
    const referer = headersList.get("referer");

    if (referer && !referer.includes(ctx.path)) {
      return redirect(referer);
    }

    return redirect("/");
  }

  return await next();
};

export const EnsuredUser: VeapMiddleware = async (_ctx, next) => {
  const { user, session } = await getCurrentSession();

  if (!user || !session) {
    return redirect("/signin");
  }

  return await next();
};

/**
 * Page-level opt-out from modular security requirements (2FA challenges,
 * onboarding gates, ...). Append it AFTER EnsuredAuth in a page's
 * `middlewares` export. Its marker propagates to the renderer, which skips
 * EnsuredAuth entirely for this route, while explicit auth/roles/permissions
 * (from the page itself) are still enforced by the pipeline below.
 */
export const SkipSecurity: VeapMiddleware = async (ctx, next) => {
  (ctx as VeapMiddlewareContext & { __skipSecurity?: boolean }).__skipSecurity =
    true;
  return await next();
};

export const EnsuredAuth: VeapMiddleware = async (ctx, next) => {
  const { user, session } = await getCurrentSession();

  if (!user || !session) {
    return redirect("/signin");
  }

  const security = await checkSecurity(
    session,
    user,
    ctx.roles,
    ctx.permissions,
    undefined,
    ctx.path,
  );

  if (!security.satisfied) {
    return redirect(security.redirect || "/signin");
  }

  return await next();
};

export const ApiEnsuredAuth: ApiMiddleware = async (
  _request,
  context,
  next,
) => {
  const { user, session } = await getCurrentSession();

  if (!user || !session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const security = await checkSecurity(
    session,
    user,
    context.roles,
    context.permissions,
    undefined,
    context.path,
  );

  if (!security.satisfied) {
    return new Response(
      JSON.stringify({
        error: "Security requirement not met",
        redirect: security.redirect,
      }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  return await next();
};

export async function runPipeline(
  middlewares: VeapMiddleware[],
  context: VeapMiddlewareContext,
  final: (context: VeapMiddlewareContext) => Promise<React.ReactNode>,
): Promise<React.ReactNode> {
  let index = 0;

  async function next(): Promise<React.ReactNode> {
    if (index < middlewares.length) {
      const middleware = middlewares[index++];
      return await middleware(context, next);
    }
    return await final(context);
  }

  return await next();
}

export async function runApiPipeline(
  middlewares: ApiMiddleware[],
  request: Request,
  context: any,
  final: (request: Request, context: any) => Promise<Response>,
): Promise<Response> {
  let index = 0;

  async function next(): Promise<Response> {
    if (index < middlewares.length) {
      const middleware = middlewares[index++];
      return await middleware(request, context, next);
    }
    return await final(request, context);
  }

  return await next();
}
