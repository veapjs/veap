"use server";

import { authContext } from "../context";

/**
 * CORE RBAC LOGIC (Facade)
 * Thin server-action surface over `RbacService`; the service itself talks to
 * the role/permission repositories.
 */

// --- Roles ---

export async function getRoles() {
  return authContext().rbac.getRoles();
}

export async function getRoleById(roleId: string) {
  return authContext().rbac.getRoleById(roleId);
}

export async function createRole(name: string, description?: string) {
  return authContext().rbac.createRole(name, description);
}

export async function deleteRole(roleId: string): Promise<void> {
  return authContext().rbac.deleteRole(roleId);
}

// --- Permissions ---

export async function getPermissions() {
  return authContext().rbac.getPermissions();
}

export async function getPermissionById(permissionId: string) {
  return authContext().rbac.getPermissionById(permissionId);
}

export async function createPermission(name: string, description?: string) {
  return authContext().rbac.createPermission(name, description);
}

export async function deletePermission(permissionId: string): Promise<void> {
  return authContext().rbac.deletePermission(permissionId);
}

// --- Mappings ---

export async function getRolePermissions(roleId: string) {
  return authContext().rbac.getRolePermissions(roleId);
}

export async function assignPermissionToRole(
  roleId: string,
  permissionId: string,
): Promise<void> {
  return authContext().rbac.assignPermissionToRole(roleId, permissionId);
}

export async function revokePermissionFromRole(
  roleId: string,
  permissionId: string,
): Promise<void> {
  return authContext().rbac.revokePermissionFromRole(roleId, permissionId);
}

// --- User Assignment ---

export async function assignRoleToUser(
  userId: string,
  roleId: string,
): Promise<void> {
  return authContext().rbac.assignRoleToUser(userId, roleId);
}

export async function revokeRoleFromUser(
  userId: string,
  roleId: string,
): Promise<void> {
  return authContext().rbac.revokeRoleFromUser(userId, roleId);
}

export async function assignPermissionToUser(
  userId: string,
  permissionId: string,
): Promise<void> {
  return authContext().rbac.assignPermissionToUser(userId, permissionId);
}

export async function revokePermissionFromUser(
  userId: string,
  permissionId: string,
): Promise<void> {
  return authContext().rbac.revokePermissionFromUser(userId, permissionId);
}

export async function getUserRbacData(userId: string) {
  return authContext().rbac.getUserRbacData(userId);
}
