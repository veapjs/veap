import { Model } from "../../../infrastructure/database/orm/model";
import { Permission } from "./Permission";
import { User } from "./User";

export interface RoleAttributes {
  id: string;
  name: string;
  description?: string | null;
}

export class Role extends Model<RoleAttributes> {
  static table = "roles";
  static timestamps = false;

  /**
   * Users assigned to this role.
   */
  users() {
    return this.belongsToMany(
      User,
      "users_to_roles",
      "role_id",
      "user_id",
      "id",
      "id",
    );
  }

  /**
   * Permissions granted to this role.
   */
  permissions() {
    return this.belongsToMany(
      Permission,
      "roles_to_permissions",
      "role_id",
      "permission_id",
      "id",
      "id",
    );
  }
}
