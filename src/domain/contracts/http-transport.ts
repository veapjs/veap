import type { Token } from "./token";

/**
 * Options for setting a cookie, mirroring the common subset of what HTTP
 * runtimes support. The Next.js adapter maps them onto the native API.
 */
export interface CookieOptions {
  expires?: Date;
  httpOnly?: boolean;
  path?: string;
  sameSite?: "lax" | "strict" | "none";
  secure?: boolean;
}

/**
 * Cookie-store port.
 *
 * Reading and writing request cookies is a transport concern; auth services
 * use this contract so they stay free of `next/headers` and can be unit-tested
 * with an in-memory store. The Next.js adapter lives in `infrastructure/http/`
 * and is bound to `COOKIE_STORE` by the kernel provider.
 */
export interface ICookieStore {
  get(name: string): Promise<string | null>;
  set(name: string, value: string, options?: CookieOptions): Promise<void>;
  delete(name: string): Promise<void>;
}

/**
 * Request-context port for the remaining transport primitives used by
 * application services: request headers and server-side redirects.
 */
export interface IHttpRequestContext {
  /** Returns a request header value, or null when absent. */
  getHeader(name: string): Promise<string | null>;

  /** Throws the runtime's redirect signal (e.g. Next.js NEXT_REDIRECT). */
  redirect(url: string): never;
}

/**
 * Injection tokens. Global symbols keep them stable across HMR /
 * dual-package boundaries, like every other port token.
 */
export const COOKIE_STORE: Token<ICookieStore> = Symbol.for(
  "veap:kernel:cookie-store",
);

export const REQUEST_CONTEXT: Token<IHttpRequestContext> = Symbol.for(
  "veap:kernel:request-context",
);
