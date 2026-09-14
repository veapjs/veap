import { getKnex } from "../../database";
import { Permission } from "../models/Permission";
import { Role } from "../models/Role";
import { User } from "../models/User";
import type {
  AccessGrant,
  CreateRoleRecord,
  IRoleRepository,
  RoleRecord,
  UserAccess,
} from "../../../domain/auth/repositories/role.repository";

/**
 * `IRoleRepository` adapter backed by the `Role` ActiveRecord model and the
 * `users_to_roles` pivot table.
 */
export class ActiveRecordRoleRepository implements IRoleRepository {
  async findAll(): Promise<RoleRecord[]> {
    const roles = await Role.query().orderBy("name", "asc").get();
    return roles.map((role) => role.toJSON() as RoleRecord);
  }

  async findById(id: string): Promise<RoleRecord | undefined> {
    const role = await Role.find(id);
    return role ? (role.toJSON() as RoleRecord) : undefined;
  }

  async findByName(name: string): Promise<RoleRecord | null> {
    const role = await Role.where("name", name).first();
    return role ? (role.toJSON() as RoleRecord) : null;
  }

  async create(record: CreateRoleRecord): Promise<RoleRecord> {
    const role = await Role.create({
      name: record.name,
      description: record.description,
    });

    return role.toJSON() as RoleRecord;
  }

  async remove(id: string): Promise<void> {
    await Role.destroy(id);
  }

  async getPermissions(roleId: string): Promise<AccessGrant[]> {
    const role = await Role.find(roleId);
    if (!role) return [];

    const permissions = await role.permissions().get();
    return permissions.map((permission) => ({
      id: permission.id as string,
      name: permission.name as string,
    }));
  }

  async loadUserAccess(userId: string): Promise<UserAccess | null> {
    const user = await User.query()
      .with("roles.permissions", "permissions")
      .find(userId);

    if (!user) return null;

    const roles = (user.getRelation("roles") as Role[]) || [];
    const direct = (user.getRelation("permissions") as Permission[]) || [];

    return {
      roles: roles.map((role) => ({
        id: role.id as string,
        name: role.name as string,
        permissions: (
          (role.getRelation("permissions") as Permission[]) || []
        ).map((permission) => ({
          id: permission.id as string,
          name: permission.name as string,
        })),
      })),
      directPermissions: direct.map((permission) => ({
        id: permission.id as string,
        name: permission.name as string,
      })),
    };
  }

  async assignToUser(userId: string, roleId: string): Promise<void> {
    const knex = getKnex();
    await knex("users_to_roles")
      .insert({ user_id: userId, role_id: roleId })
      .onConflict(["user_id", "role_id"])
      .ignore();
  }

  async revokeFromUser(userId: string, roleId: string): Promise<void> {
    const knex = getKnex();
    await knex("users_to_roles")
      .where({
        user_id: userId,
        role_id: roleId,
      })
      .delete();
  }
}
