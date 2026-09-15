/**
 * Settings persistence port.
 *
 * The application layer depends on this abstraction only; the concrete
 * ActiveRecord implementation lives in
 * `infrastructure/settings/repositories`.
 */
export interface ISettingsRepository {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

/**
 * Injection token for the settings repository port.
 *
 * A global symbol keeps the token stable across HMR / dual-package
 * boundaries, the same reason the container keys class tokens with
 * `Symbol.for(...)`.
 */
export const SETTINGS_REPOSITORY = Symbol.for("veap:settings:repository");
