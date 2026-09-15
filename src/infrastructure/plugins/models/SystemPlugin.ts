import type { CastType } from "../../../infrastructure/database/orm/casts";
import { Model } from "../../../infrastructure/database/orm/model";

export interface SystemPluginAttributes {
  id: string;
  enabled: boolean;
  installed: boolean;
  deleted: boolean;
  system: boolean;
  config?: string | null;
  lastStep?: string | null;
  last_step?: string | null;
  updatedAt?: Date | null;
  updated_at?: Date | null;
}

export class SystemPlugin extends Model<SystemPluginAttributes> {
  static table = "plugins";
  static autoUuid = false;
  static timestamps: boolean | string[] = ["updated_at"];

  static casts: Record<string, CastType> = {
    enabled: "boolean",
    installed: "boolean",
    deleted: "boolean",
    system: "boolean",
    updatedAt: "datetime",
    updated_at: "datetime",
  };
}
