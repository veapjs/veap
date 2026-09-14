/** A role as persisted (already mapped to a plain object). */
export interface RoleRecord {
  id: string;
  name: string;
  description?: string | null;
  [key: string]: any;
}

/** Minimal `{ id, name }` reference used by RBAC read models. */
export interface AccessGrant {
  id: string;
  name: string;
}

/**
 * The roles and permissions graph of a single user, as loaded from the
 * persistence layer.
 */
export interface UserAccess {
  roles: Array<AccessGrant & { permissions: AccessGrant[] }>;
  directPermissions: AccessGrant[];
}

export interface CreateRoleRecord {
  name: string;
  description?: string;
}

/**
 * Role persistence port.
 *
 * Besides CRUD it owns the role/permission → user assignments, because those
 * pivots are part of the role aggregate.
 */
export interface IRoleRepository {
  findAll(): Promise<RoleRecord[]>;

  findById(id: string): Promise<RoleRecord | undefined>;

  findByName(name: string): Promise<RoleRecord | null>;

  create(record: CreateRoleRecord): Promise<RoleRecord>;

  remove(id: string): Promise<void>;

  /** Permissions granted to a role. */
  getPermissions(roleId: string): Promise<AccessGrant[]>;

  /**
   * Loads the full role/permission graph for a user.
   * Returns `null` when the user does not exist.
   */
  loadUserAccess(userId: string): Promise<UserAccess | null>;

  assignToUser(userId: string, roleId: string): Promise<void>;

  revokeFromUser(userId: string, roleId: string): Promise<void>;
}

/** Injection token for the role repository port. */
export const ROLE_REPOSITORY = Symbol.for("veap:auth:role-repository");
