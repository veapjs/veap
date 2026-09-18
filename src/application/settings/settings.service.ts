import { Inject, Injectable } from "../../domain/contracts/ioc";
import { CACHE_PROVIDER } from "../../domain/contracts";
import type { ICacheProvider } from "../../domain/contracts/cache";
import {
  SETTINGS_REPOSITORY,
  type ISettingsRepository,
} from "../../domain/settings/settings.repository";

/**
 * Application service for reading and writing settings.
 *
 * It depends exclusively on ports ({@link ICacheProvider},
 * {@link ISettingsRepository}) that are injected through the constructor;
 * it has no knowledge of the ORM or of the IoC container.
 */
@Injectable()
export class SettingsService {
  constructor(
    @Inject(CACHE_PROVIDER) private cache: ICacheProvider,
    @Inject(SETTINGS_REPOSITORY) private repository: ISettingsRepository,
  ) {}

  /**
   * Get a setting value by key.
   * @param key Setting key (e.g., "system:page")
   * @returns Value as T or null
   */
  public async get<T>(key: string): Promise<T | null> {
    const cacheKey = `settings:${key}`;
    const cached = await this.cache.get<T>(cacheKey);
    if (cached !== null) return cached;

    const value = await this.repository.get<T>(key);
    if (value !== null) {
      await this.cache.set(cacheKey, value);
    }
    return value;
  }

  /**
   * Set a setting value.
   * @param key Setting key
   * @param value JSON value
   */
  public async set(key: string, value: unknown): Promise<void> {
    await this.repository.set(key, value);
    await this.cache.set(`settings:${key}`, value);
  }

  /**
   * Remove a setting by key.
   * @param key Setting key
   */
  public async remove(key: string): Promise<void> {
    await this.repository.delete(key);
    await this.cache.delete(`settings:${key}`);
  }

  /**
   * Clear all settings.
   */
  public async clear(): Promise<void> {
    await this.repository.clear();
    // Cache clearing specific to settings might be hard if we use a shared cache,
    // but in memory provider it clears everything.
    await this.cache.clear();
  }
}
