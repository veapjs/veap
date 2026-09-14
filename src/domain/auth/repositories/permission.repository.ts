/** A permission as persisted (already mapped to a plain object). */
export interface PermissionRecord {
  id: string;
  name: string;
  description?: string | null;
  [key: string]: any;
}

export interface CreatePermissionRecord {
  name: string;
  description?: string;
}

/**
 * Permission persistence port.
 *
 * Owns permissions CRUD plus the permission → role / permission → user pivots.
 */
export interface IPermissionRepository {
  findAll(): Promise<PermissionRecord[]>;

  findById(id: string): Promise<PermissionRecord | undefined>;

  create(record: CreatePermissionRecord): Promise<PermissionRecord>;

  remove(id: string): Promise<void>;

  assignToRole(roleId: string, permissionId: string): Promise<void>;

  revokeFromRole(roleId: string, permissionId: string): Promise<void>;

  assignToUser(userId: string, permissionId: string): Promise<void>;

  revokeFromUser(userId: string, permissionId: string): Promise<void>;
}

/** Injection token for the permission repository port. */
export const PERMISSION_REPOSITORY = Symbol.for(
  "veap:auth:permission-repository",
);
