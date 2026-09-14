import { getKnex } from "../../database";
import { Permission } from "../models/Permission";
import type {
  CreatePermissionRecord,
  IPermissionRepository,
  PermissionRecord,
} from "../../../domain/auth/repositories/permission.repository";

/**
 * `IPermissionRepository` adapter backed by the `Permission` ActiveRecord model
 * and the `roles_to_permissions` / `users_to_permissions` pivot tables.
 */
export class ActiveRecordPermissionRepository implements IPermissionRepository {
  async findAll(): Promise<PermissionRecord[]> {
    const permissions = await Permission.query().orderBy("name", "asc").get();
    return permissions.map(
      (permission) => permission.toJSON() as PermissionRecord,
    );
  }

  async findById(id: string): Promise<PermissionRecord | undefined> {
    const permission = await Permission.find(id);
    return permission ? (permission.toJSON() as PermissionRecord) : undefined;
  }

  async create(record: CreatePermissionRecord): Promise<PermissionRecord> {
    const permission = await Permission.create({
      name: record.name,
      description: record.description,
    });

    return permission.toJSON() as PermissionRecord;
  }

  async remove(id: string): Promise<void> {
    await Permission.destroy(id);
  }

  async assignToRole(roleId: string, permissionId: string): Promise<void> {
    const knex = getKnex();
    await knex("roles_to_permissions")
      .insert({ role_id: roleId, permission_id: permissionId })
      .onConflict(["role_id", "permission_id"])
      .ignore();
  }

  async revokeFromRole(roleId: string, permissionId: string): Promise<void> {
    const knex = getKnex();
    await knex("roles_to_permissions")
      .where({
        role_id: roleId,
        permission_id: permissionId,
      })
      .delete();
  }

  async assignToUser(userId: string, permissionId: string): Promise<void> {
    const knex = getKnex();
    await knex("users_to_permissions")
      .insert({ user_id: userId, permission_id: permissionId })
      .onConflict(["user_id", "permission_id"])
      .ignore();
  }

  async revokeFromUser(userId: string, permissionId: string): Promise<void> {
    const knex = getKnex();
    await knex("users_to_permissions")
      .where({
        user_id: userId,
        permission_id: permissionId,
      })
      .delete();
  }
}
