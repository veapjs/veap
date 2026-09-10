import fs from "node:fs/promises";
import path from "node:path";
import { Injectable } from "../../domain/contracts/ioc";
import { PluginRegistry } from "../plugins/registry";
import type { AbstractIntlMessages } from "../../domain/intl/types";

function deepMerge(target: any, source: any) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] instanceof Object &&
      key in target &&
      target[key] instanceof Object
    ) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

@Injectable()
export class IntlService {
  constructor(private readonly pluginRegistry: PluginRegistry) {}

  private registeredMessages: Record<string, AbstractIntlMessages> = {};
  private coreLocales: Record<string, () => Promise<{ default: any }>> = {
    en: () => import("../../domain/intl/locales/en"),
    pl: () => import("../../domain/intl/locales/pl"),
  };

  public registerMessages(locale: string, messages: any) {
    if (!this.registeredMessages[locale]) {
      this.registeredMessages[locale] = {};
    }
    this.registeredMessages[locale] = deepMerge(
      this.registeredMessages[locale],
      messages,
    );
  }

  public async getMessages(locale: string, searchDirectories?: string[]) {
    let messages: AbstractIntlMessages = this.registeredMessages[locale] || {};

    // 1. Load Core veap locales
    if (this.coreLocales[locale]) {
      try {
        const coreDict = await this.coreLocales[locale]();
        messages = deepMerge(messages, coreDict.default || coreDict);
      } catch (e) {
        console.error("[veap:Intl] Error loading core locale", e);
      }
    }

    // 2. Load Plugin locales
    const plugins = this.pluginRegistry.getPlugins();
    for (const plugin of plugins) {
      if (plugin.locales && plugin.locales[locale]) {
        try {
          const pluginDict = await plugin.locales[locale]();
          messages = deepMerge(messages, pluginDict.default || pluginDict);
        } catch (e) {
          console.error(
            `[veap:Intl] Error loading locale ${locale} for plugin ${plugin.manifest.id}`,
            e,
          );
        }
      }
    }

    // 3. Load App-level locales
    const defaultDir = path.join(process.cwd(), "locales");
    const directoriesToScan = new Set<string>();
    if (searchDirectories) {
      for (const p of searchDirectories) directoriesToScan.add(p);
    }
    directoriesToScan.add(defaultDir);

    for (const dir of Array.from(directoriesToScan)) {
      const localeFile = path.join(dir, `${locale}.json`);
      try {
        const fileContent = await fs.readFile(localeFile, "utf-8");
        const jsonContent = JSON.parse(fileContent);
        messages = deepMerge(messages, jsonContent);
      } catch (_e) {
        // Ignore missing files
      }
    }

    return messages;
  }
}
