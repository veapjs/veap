import type { Token } from "./token";

export interface ICacheProvider {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

/**
 * Injection token for the cache port.
 *
 * A global symbol keeps the token stable across HMR / dual-package
 * boundaries, the same reason the container keys class tokens with
 * `Symbol.for(...)`. (Historical name kept: the first cache provider was
 * registered under the string key "CacheProvider".)
 */
export const CACHE_PROVIDER: Token<ICacheProvider> =
  Symbol.for("veap:kernel:cache");
