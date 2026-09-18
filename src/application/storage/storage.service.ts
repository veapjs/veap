import { Inject, Injectable } from "../../domain/contracts/ioc";
import { LOGGER } from "../../domain/contracts";
import type { ILogger } from "../../domain/contracts/logger";
import type {
  IStorageProvider,
  StorageResult,
} from "../../domain/storage/types";

@Injectable()
export class StorageService {
  private providers: Map<string, IStorageProvider> = new Map();
  private defaultProviderId: string | null = null;
  private logger: ILogger;

  constructor(@Inject(LOGGER) logger: ILogger) {
    this.logger = logger;
  }

  public registerProvider(provider: IStorageProvider) {
    this.providers.set(provider.id, provider);
    if (!this.defaultProviderId || this.defaultProviderId === "local") {
      this.defaultProviderId = provider.id;
    }

    this.logger.info("veap:storage", `Provider registered: ${provider.id}`);
  }

  public unregisterProvider(id: string) {
    this.providers.delete(id);
    if (this.defaultProviderId === id) {
      this.defaultProviderId = this.providers.has("local")
        ? "local"
        : Array.from(this.providers.keys())[0] || null;
    }
    this.logger.info("veap:storage", `Provider unregistered: ${id}`);
  }

  public setDefaultProvider(id: string) {
    if (this.providers.has(id)) {
      this.defaultProviderId = id;
      this.logger.info("veap:storage", `Default provider set to: ${id}`);
    }
  }

  public async upload(file: File, providerId?: string): Promise<StorageResult> {
    let id = providerId || this.defaultProviderId;

    if (!id || !this.providers.has(id)) {
      id = "local";
    }

    const provider = this.providers.get(id);

    if (!provider) {
      this.logger.warn(
        "veap:storage",
        `No storage provider available (local fallback failed)`,
      );
      return { error: "No storage provider available (local fallback failed)" };
    }

    return await provider.upload(file);
  }

  public async delete(keyOrUrl: string, providerId?: string): Promise<boolean> {
    let id = providerId || this.defaultProviderId;

    if (!id || !this.providers.has(id)) {
      id = "local";
    }

    const provider = this.providers.get(id);

    if (!provider) {
      this.logger.warn(
        "veap:storage",
        `No storage provider available for deletion (local fallback failed)`,
      );
      return false;
    }

    if (!provider.delete) {
      this.logger.warn(
        "veap:storage",
        `Storage provider "${id}" does not support deletion`,
      );
      return false;
    }

    return await provider.delete(keyOrUrl);
  }

  public getProviders() {
    return Array.from(this.providers.values()).map((p) => ({
      id: p.id,
      name: p.name,
    }));
  }
}
