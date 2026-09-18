/**
 * Dependency injection token vocabulary.
 *
 * A token is a string/symbol registry key or a class constructor. Symbol
 * tokens defined next to their contracts in `domain/contracts/*` (and next to
 * the repository ports) stay stable across HMR / dual-package boundaries,
 * the same reason the container keys class tokens with `Symbol.for(...)`.
 *
 * The type lives in the domain so contract files can annotate their tokens
 * (`export const LOGGER: Token<ILogger> = Symbol.for(...)`) and consumers get
 * typed `app(TOKEN)` / `container.resolve(TOKEN)` results - while the
 * container merely re-exports it. Pure type, no imports: the dependency
 * direction `infrastructure → domain` stays intact.
 */
export type Token<T = any> = string | symbol | (new (...args: any[]) => T);

export const DATABASE: Token<any> = Symbol.for("veap:kernel:database");
export const APP_PLUGINS: Token<any[]> = Symbol.for("veap:kernel:app-plugins");
export const APP_TEMPLATES: Token<any[]> = Symbol.for(
  "veap:kernel:app-templates",
);
export const APP_MIGRATIONS: Token<any[]> = Symbol.for(
  "veap:kernel:app-migrations",
);
export const CLI_SERVICE: Token<any> = Symbol.for("veap:kernel:cli-service");
