import type { IVeapConfigProvider } from "../../domain/contracts/veap-config";
import type { VeapConfig } from "../../domain/config";
import { getVeapConfig } from "./config.loader";

/**
 * `IVeapConfigProvider` adapter backed by the jiti-based `veap.config.ts`
 * loader. This is the only place the application layer needs to know about.
 */
export class VeapConfigProvider implements IVeapConfigProvider {
  get(): Promise<VeapConfig> {
    return getVeapConfig();
  }
}
