import type { CastType } from "../../../infrastructure/database/orm/casts";
import { Model } from "../../../infrastructure/database/orm/model";
import { User } from "./User";

export interface EmailVerificationAttributes {
  id: string;
  email: string;
  code: string;
  userId: string;
  user_id?: string;
  expiresAt: Date;
  expires_at?: Date;
  createdAt?: Date;
  created_at?: Date;
  updatedAt?: Date | null;
  updated_at?: Date | null;
}

export class EmailVerification extends Model<EmailVerificationAttributes> {
  static table = "verification_requests";

  static casts: Record<string, CastType> = {
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
