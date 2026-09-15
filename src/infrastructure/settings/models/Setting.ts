import type { CastType } from "../../../infrastructure/database/orm/casts";
import { Model } from "../../../infrastructure/database/orm/model";

export interface SettingAttributes {
  id: string;
  key: string;
  value: any;
  updatedAt?: Date | null;
  updated_at?: Date | null;
}

export class Setting extends Model<SettingAttributes> {
  static table = "settings";
  static timestamps: boolean | string[] = ["updated_at"];

  static casts: Record<string, CastType> = {
    value: "json",
    updatedAt: "datetime",
    updated_at: "datetime",
  };

  /**
   * Helper to quickly get a setting by key.
   */
  static async getValue<T = any>(
    key: string,
    defaultValue: T | null = null,
  ): Promise<T | null> {
    const setting = await this.where("key", key).first();
    return setting ? (setting.getAttribute("value") as T) : defaultValue;
  }

  /**
   * Helper to quickly set/update a setting by key.
   */
  static async setValue(key: string, value: any): Promise<Setting> {
    let setting = await this.where("key", key).first();
    if (setting) {
      setting.setAttribute("value", value);
      await setting.save();
    } else {
      setting = await this.create({ key, value });
    }
    return setting;
  }
}
