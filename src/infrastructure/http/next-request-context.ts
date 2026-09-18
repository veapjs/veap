import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import type {
  CookieOptions,
  ICookieStore,
  IHttpRequestContext,
} from "../../domain/contracts/http-transport";

/**
 * Next.js `cookies()` adapter for the {@link ICookieStore} port.
 *
 * Thin wrapper over the request-scoped cookie store: `cookies()` must be
 * awaited per call, which is why each method awaits it lazily rather than
 * caching a handle - this keeps the adapter safe across request boundaries.
 */
export class NextCookieStore implements ICookieStore {
  public async get(name: string): Promise<string | null> {
    return (await cookies()).get(name)?.value ?? null;
  }

  public async set(
    name: string,
    value: string,
    options?: CookieOptions,
  ): Promise<void> {
    (await cookies()).set(name, value, options);
  }

  public async delete(name: string): Promise<void> {
    (await cookies()).delete(name);
  }
}

/**
 * Next.js adapter for the {@link IHttpRequestContext} port.
 *
 * Wraps `headers()` (e.g. for `x-forwarded-for`) and `redirect()` from
 * `next/navigation` behind the port so application services never import
 * Next.js directly.
 */
export class NextRequestContext implements IHttpRequestContext {
  public async getHeader(name: string): Promise<string | null> {
    return (await headers()).get(name);
  }

  public redirect(url: string): never {
    redirect(url);
  }
}
