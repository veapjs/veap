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

  public async set(name: string, value: string, options?: CookieOptions): Promise<void> {
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

export interface RequestLike {
  headers: Headers | { get(name: string): string | null };
  method?: string;
}

/**
 * Verifies that a state-changing HTTP request originates from the same origin.
 * Checks the Sec-Fetch-Site and Origin headers against Host / X-Forwarded-Host.
 * Safe HTTP methods (GET, HEAD, OPTIONS) always pass.
 */
export function verifySameOrigin(request: Request | RequestLike): boolean {
  const method = (request.method || "GET").toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return true;
  }

  // 1. Sec-Fetch-Site validation (Fetch Metadata standard)
  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite && secFetchSite === "cross-site") {
    return false;
  }

  // 2. Origin / Host validation
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");

  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      return originHost === host;
    } catch {
      return false;
    }
  }

  return true;
}
