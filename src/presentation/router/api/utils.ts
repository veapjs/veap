import type { UserPermission, UserRole } from "../../../domain/auth/types";
import type { ApiMiddleware, VeapMiddleware } from "../../../domain/plugins/types";
import type {
  LayoutChainEntry,
  MatchResult,
} from "../../../application/router/route-tree";

export function collectMiddlewares(
  chain: LayoutChainEntry[],
  node: MatchResult["node"],
): VeapMiddleware[] {
  const all: VeapMiddleware[] = [];

  for (const entry of chain) {
    if (entry.middlewares) {
      all.push(...(entry.middlewares as VeapMiddleware[]));
    }
  }

  if (node.middlewares) {
    all.push(...(node.middlewares as VeapMiddleware[]));
  }

  return all;
}

export function collectApiMiddlewares(
  chain: LayoutChainEntry[],
  node: MatchResult["node"],
): ApiMiddleware[] {
  const all: ApiMiddleware[] = [];

  for (const entry of chain) {
    if (entry.middlewares) {
      all.push(...(entry.middlewares as ApiMiddleware[]));
    }
  }

  if (node.middlewares) {
    all.push(...(node.middlewares as ApiMiddleware[]));
  }

  return all;
}

export function collectAuthRequirements(
  chain: LayoutChainEntry[],
  node: MatchResult["node"],
): {
  needsAuth: boolean;
  roles: UserRole[];
  permissions: UserPermission[];
} {
  let needsAuth = false;
  const roles: UserRole[] = [];
  const permissions: UserPermission[] = [];

  for (const entry of chain) {
    if (entry.auth) needsAuth = true;
    if (entry.roles) roles.push(...entry.roles);
    if (entry.permissions) permissions.push(...entry.permissions);
  }

  if (node.auth) needsAuth = true;
  if (node.roles) roles.push(...node.roles);
  if (node.permissions) permissions.push(...node.permissions);

  return {
    needsAuth: needsAuth || roles.length > 0 || permissions.length > 0,
    roles: [...new Set(roles)],
    permissions: [...new Set(permissions)],
  };
}
