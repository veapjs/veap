import { Inject, Injectable } from "../../domain/contracts/ioc";

import { AppError } from "../../domain/errors/app-error";
import type { IEventBus } from "../../domain/contracts/event-bus";
import type { ILogger } from "../../domain/contracts/logger";
import type { ITemplate } from "../../domain/plugins/types";
import {
  TEMPLATE_REPOSITORY,
  type ITemplateRepository,
} from "../../domain/plugins/repositories/template.repository";
import { EVENT_BUS, LOGGER } from "../../domain/contracts";
import { SettingsService } from "../settings/settings.service";
import { pluginsContext } from "./context";
import { cache } from "react";

const globalForPlugins = globalThis as any;

if (!globalForPlugins.__VEAP_REGISTERED_TEMPLATES__) {
  globalForPlugins.__VEAP_REGISTERED_TEMPLATES__ = new Map<string, ITemplate>();
}

/**
 * Application service for template registration and configuration.
 *
 * Persistence goes through the {@link ITemplateRepository} port; settings
 * through {@link SettingsService}. No ORM, no container lookups.
 */
@Injectable()
export class TemplateService {
  constructor(
    @Inject(TEMPLATE_REPOSITORY)
    private readonly templates: ITemplateRepository,
    private readonly settings: SettingsService,
    @Inject(EVENT_BUS) private readonly eventBus: IEventBus,
    @Inject(LOGGER) private readonly logger: ILogger,
  ) {}

  private get store(): Map<string, ITemplate> {
    return globalForPlugins.__VEAP_REGISTERED_TEMPLATES__ as Map<
      string,
      ITemplate
    >;
  }

  public async register(templates: ITemplate[]) {
    for (const template of templates) {
      this.store.set(template.id, template);

      // Sync with database
      try {
        await this.templates.ensureRegistered(
          `template:${template.id}`,
          template.defaultConfig,
        );
      } catch (_e) {
        // Ignore errors if table doesn't exist yet during bootstrap
      }
    }
  }

  public getRegistered(): ITemplate[] {
    return Array.from(this.store.values());
  }

  public has(templateId: string): boolean {
    return this.store.has(templateId);
  }

  public async getActive(): Promise<ITemplate | null> {
    if (this.store.size === 0) return null;

    try {
      const activeTemplateId =
        await this.settings.get<string>("system:template");
      if (activeTemplateId && this.store.has(activeTemplateId)) {
        return this.store.get(activeTemplateId) || null;
      }
    } catch (e) {
      this.logger.warn(
        "veap:Templates",
        "Failed to fetch active template from settings.",
        e,
      );
    }

    // Fallback to the first registered template
    return Array.from(this.store.values())[0] || null;
  }

  public async setActive(templateId: string): Promise<void> {
    if (!this.store.has(templateId)) {
      throw AppError.Internal(
        `[Kernel:Templates] Template "${templateId}" is not registered.`,
      );
    }

    await this.settings.set("system:template", templateId);

    await this.eventBus.publish("system:template:toggle", {
      templateId,
      isEnabled: true,
    });
  }

  public async getConfig<T = any>(templateId: string): Promise<T> {
    const template = this.store.get(templateId);
    const defaultConfig = template?.defaultConfig || {};

    try {
      const configJson = await this.templates.findConfigJson(
        `template:${templateId}`,
      );

      if (!configJson) return defaultConfig as T;

      const savedConfig = JSON.parse(configJson);

      // Merge default with saved (saved takes precedence)
      return { ...defaultConfig, ...savedConfig } as T;
    } catch {
      return defaultConfig as T;
    }
  }

  public async updateConfig(templateId: string, config: any) {
    const id = `template:${templateId}`;
    try {
      await this.templates.saveConfigJson(id, JSON.stringify(config));
    } catch (e) {
      this.logger.warn(
        "veap:Templates",
        `Failed to update template config for ${templateId}:`,
        e,
      );
    }
  }
}

// ─── Module-level API (composition-bound) ────────────────────────────────────

export const registerTemplates = (templates: ITemplate[]) =>
  pluginsContext().templates.register(templates);

export const getActiveTemplate = cache(async (): Promise<ITemplate | null> =>
  pluginsContext().templates.getActive(),
);

export async function setActiveTemplate(templateId: string): Promise<void> {
  return pluginsContext().templates.setActive(templateId);
}

export const getTemplateConfig = cache(
  async <T = any>(templateId: string): Promise<T> =>
    pluginsContext().templates.getConfig<T>(templateId),
);

export async function updateTemplateConfig(templateId: string, config: any) {
  return pluginsContext().templates.updateConfig(templateId, config);
}
