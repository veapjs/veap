import { SystemPlugin } from "../models/SystemPlugin";
import type { ITemplateRepository } from "../../../domain/plugins/repositories/template.repository";

/**
 * `ITemplateRepository` adapter backed by the `SystemPlugin` model.
 *
 * Templates share the `plugins` table under the `template:<id>` synthetic id;
 * this adapter is the only place aware of that convention.
 */
export class ActiveRecordTemplateRepository implements ITemplateRepository {
  async ensureRegistered(
    id: string,
    defaultConfig: Record<string, any> | undefined,
  ): Promise<void> {
    const exists = await SystemPlugin.find(id);
    if (exists) return;

    await SystemPlugin.create({
      id,
      enabled: true,
      installed: true,
      system: false,
      config: JSON.stringify(defaultConfig || {}),
    });
  }

  async findConfigJson(id: string): Promise<string | null> {
    const row = await SystemPlugin.find(id);
    return row?.config ?? null;
  }

  async saveConfigJson(id: string, configJson: string): Promise<void> {
    const exists = await SystemPlugin.find(id);

    if (exists) {
      exists.setAttribute("config", configJson);
      exists.setAttribute("updatedAt", new Date());
      await exists.save();
      return;
    }

    await SystemPlugin.create({
      id,
      enabled: true,
      installed: true,
      system: false,
      config: configJson,
    });
  }
}
