import type { CastType } from "../../../infrastructure/database/orm/casts";
import { Model } from "../../../infrastructure/database/orm/model";
import { Permission } from "./Permission";
import { Role } from "./Role";
import { Session } from "./Session";

export interface UserAttributes {
  id: string;
  email: string;
  name: string;
  password?: string | null;
  image?: string | null;
  recovery_code?: any;
  emailVerifiedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date | null;
}

export class User extends Model<UserAttributes> {
  static table = "users";

  static hidden = ["password", "recovery_code"];

  static casts: Record<string, CastType> = {
    emailVerifiedAt: "datetime",
    createdAt: "datetime",
    updatedAt: "datetime",
  };

  /**
   * User sessions relation.
   */
  sessions() {
    return this.hasMany(Session, "user_id");
  }

  /**
   * User roles relation via users_to_roles pivot table.
   */
  roles() {
    return this.belongsToMany(
      Role,
      "users_to_roles",
      "user_id",
      "role_id",
      "id",
      "id",
    );
  }

  /**
   * User direct permissions relation via users_to_permissions pivot table.
   */
  permissions() {
    return this.belongsToMany(
      Permission,
      "users_to_permissions",
      "user_id",
      "permission_id",
      "id",
      "id",
    );
  }
}
