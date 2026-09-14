import { Inject, Injectable } from "../../../domain/contracts/ioc";
import {
  PERMISSION_REPOSITORY,
  type IPermissionRepository,
  type PermissionRecord,
} from "../../../domain/auth/repositories/permission.repository";
import {
  ROLE_REPOSITORY,
  type AccessGrant,
  type IRoleRepository,
  type RoleRecord,
} from "../../../domain/auth/repositories/role.repository";
import type { User } from "../../../domain/auth/types";

/**
 * Core RBAC use cases. Persistence lives behind the role/permission
 * repositories, so this service stays framework-free and testable.
 */
@Injectable()
export class RbacService {
  constructor(
    @Inject(ROLE_REPOSITORY) private readonly roles: IRoleRepository,
    @Inject(PERMISSION_REPOSITORY)
    private readonly permissions: IPermissionRepository,
  ) {}

  async getRoles(): Promise<RoleRecord[]> {
    return await this.roles.findAll();
  }

  async getRoleById(roleId: string) {
    return await this.roles.findById(roleId);
  }

  async createRole(name: string, description?: string) {
    const role = await this.roles.create({ name, description });
    return [role];
  }

  async deleteRole(roleId: string): Promise<void> {
    await this.roles.remove(roleId);
  }

  async getPermissions(): Promise<PermissionRecord[]> {
    return await this.permissions.findAll();
  }

  async getPermissionById(permissionId: string) {
    return await this.permissions.findById(permissionId);
  }

  async createPermission(name: string, description?: string) {
    const permission = await this.permissions.create({ name, description });
    return [permission];
  }

  async deletePermission(permissionId: string): Promise<void> {
    await this.permissions.remove(permissionId);
  }

  async getRolePermissions(roleId: string): Promise<AccessGrant[]> {
    return await this.roles.getPermissions(roleId);
  }

  async assignPermissionToRole(
    roleId: string,
    permissionId: string,
  ): Promise<void> {
    await this.permissions.assignToRole(roleId, permissionId);
  }

  async revokePermissionFromRole(
    roleId: string,
    permissionId: string,
  ): Promise<void> {
    await this.permissions.revokeFromRole(roleId, permissionId);
  }

  async assignRoleToUser(userId: string, roleId: string): Promise<void> {
    await this.roles.assignToUser(userId, roleId);
  }

  async revokeRoleFromUser(userId: string, roleId: string): Promise<void> {
    await this.roles.revokeFromUser(userId, roleId);
  }

  async assignPermissionToUser(
    userId: string,
    permissionId: string,
  ): Promise<void> {
    await this.permissions.assignToUser(userId, permissionId);
  }

  async revokePermissionFromUser(
    userId: string,
    permissionId: string,
  ): Promise<void> {
    await this.permissions.revokeFromUser(userId, permissionId);
  }

  async getUserRbacData(userId: string) {
    const access = await this.roles.loadUserAccess(userId);

    if (!access) {
      return {
        roles: [],
        directPermissions: [],
        effectivePermissions: [],
      };
    }

    const roles = access.roles.map((role) => ({
      id: role.id,
      name: role.name,
    }));

    const directPermissions = access.directPermissions;

    const effective = new Map<string, AccessGrant>();
    for (const permission of directPermissions) {
      effective.set(permission.id, permission);
    }
    for (const role of access.roles) {
      for (const permission of role.permissions) {
        effective.set(permission.id, permission);
      }
    }

    return {
      roles,
      directPermissions,
      effectivePermissions: Array.from(effective.values()),
    };
  }

  async coreRbacAugmenter(user: User): Promise<Record<string, any>> {
    const userId = user?.id;
    if (!userId) {
      return { roles: [], permissions: [] };
    }

    try {
      const access = await this.roles.loadUserAccess(userId);
      if (!access) {
        return { roles: [], permissions: [] };
      }

      const roles = access.roles.map((role) => role.name);

      const permissions = new Set<string>();

      for (const permission of access.directPermissions) {
        if (permission.name) {
          permissions.add(permission.name);
        }
      }

      for (const role of access.roles) {
        for (const permission of role.permissions) {
          if (permission.name) {
            permissions.add(permission.name);
          }
        }
      }

      return {
        roles,
        permissions: Array.from(permissions),
      };
    } catch (error) {
      console.error("[Auth:RBAC] Failed to augment user:", error);
      return { roles: [], permissions: [] };
    }
  }
}
