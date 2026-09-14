import type { CastType } from "../../../infrastructure/database/orm/casts";
import { Model } from "../../../infrastructure/database/orm/model";
import { User } from "./User";

export interface SessionAttributes {
  id: string;
  userId?: string;
  user_id?: string;
  metadata?: Record<string, any> | null;
  expiresAt: Date;
  expires_at?: Date;
  createdAt?: Date;
  created_at?: Date;
  updatedAt?: Date | null;
  updated_at?: Date | null;
}

export class Session extends Model<SessionAttributes> {
  static table = "sessions";

  static casts: Record<string, CastType> = {
    metadata: "json",
    expiresAt: "datetime",
    expires_at: "datetime",
    createdAt: "datetime",
    created_at: "datetime",
    updatedAt: "datetime",
    updated_at: "datetime",
  };

  /**
   * Session owner user relation.
   */
  user() {
    const fk =
      this.getAttribute("user_id") !== undefined ? "user_id" : "userId";
    return this.belongsTo(User, fk);
  }
}
