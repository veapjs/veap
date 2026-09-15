import type { CastType } from "../../../infrastructure/database/orm/casts";
import { Model } from "../../../infrastructure/database/orm/model";
import { User } from "../../../infrastructure/auth/models/User";

export interface SystemUserWidgetAttributes {
  userId: string;
  user_id?: string;
  slot: string;
  state: any;
}

export class SystemUserWidget extends Model<SystemUserWidgetAttributes> {
  static table = "system_user_widgets";
  static primaryKey = "user_id";
  static autoUuid = false;
  static timestamps = false;

  static casts: Record<string, CastType> = {
    state: "json",
  };

  /**
   * Associated user relation.
   */
  user() {
    return this.belongsTo(User, "user_id");
  }
}
