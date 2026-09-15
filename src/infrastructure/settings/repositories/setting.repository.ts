import { Setting } from "../models/Setting";
import type { ISettingsRepository } from "../../../domain/settings/settings.repository";

/**
 * `ISettingsRepository` adapter backed by the `Setting` ActiveRecord model.
 *
 * This is the only place that knows how settings are persisted, so the
 * application layer can be tested with an in-memory fake.
 */
export class ActiveRecordSettingsRepository implements ISettingsRepository {
  async get<T>(key: string): Promise<T | null> {
    return Setting.getValue<T>(key, null);
  }

  async set(key: string, value: unknown): Promise<void> {
    await Setting.setValue(key, value);
  }

  async delete(key: string): Promise<void> {
    await Setting.where("key", key).delete();
  }

  async clear(): Promise<void> {
    await Setting.query().delete();
  }
}
