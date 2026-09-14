import { Model } from "../../../infrastructure/database/orm/model";
import { Role } from "./Role";
import { User } from "./User";

export interface PermissionAttributes {
  id: string;
  name: string;
  description?: string | null;
}

export class Permission extends Model<PermissionAttributes> {
  static table = "permissions";
  static timestamps = false;

  /**
   * Roles that have this permission.
   */
  roles() {
    return this.belongsToMany(
      Role,
      "roles_to_permissions",
      "permission_id",
      "role_id",
      "id",
      "id",
    );
  }

  /**
   * Users that have this permission directly.
   */
  users() {
    return this.belongsToMany(
      User,
      "users_to_permissions",
      "permission_id",
      "user_id",
      "id",
      "id",
    );
  }
}
