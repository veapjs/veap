import type { CastType } from "../../../infrastructure/database/orm/casts";
import { Model } from "../../../infrastructure/database/orm/model";
import { User } from "./User";

export interface PasswordResetSessionAttributes {
  id: string;
  email: string;
  code: string;
  emailVerified?: boolean;
  email_verified?: boolean;
  userId: string;
  user_id?: string;
  expiresAt: Date;
  expires_at?: Date;
  createdAt?: Date;
  created_at?: Date;
  updatedAt?: Date | null;
  updated_at?: Date | null;
}

export class PasswordResetSession extends Model<PasswordResetSessionAttributes> {
  static table = "reset_sessions";

  static casts: Record<string, CastType> = {
    emailVerified: "boolean",
    email_verified: "boolean",
    expiresAt: "datetime",
    expires_at: "datetime",
    createdAt: "datetime",
    created_at: "datetime",
    updatedAt: "datetime",
    updated_at: "datetime",
  };

  /**
   * Associated user relation.
   */
  user() {
    return this.belongsTo(User, "user_id");
  }
}
