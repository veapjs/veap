import { Inject, Injectable } from "../../domain/contracts/ioc";
import { authContext } from "../auth/context";
import type { IVeapConfigProvider } from "../../domain/contracts/veap-config";
import { VEAP_CONFIG } from "../../domain/contracts";
import type {
  PluginNavElement,
  PluginNavigationGroupMap,
} from "../../domain/plugins/types";
import { PluginRegistry } from "./registry";
import { pluginsContext } from "./context";

function filterNavItem(
  item: PluginNavElement,
  userRoles: string[],
  userPermissions: string[],
): PluginNavElement | null {
  if (item.roles && item.roles.length > 0) {
    if (!item.roles.some((role) => userRoles.includes(role))) {
      return null;
    }
  }

  if (item.permissions && item.permissions.length > 0) {
    if (!item.permissions.every((perm) => userPermissions.includes(perm))) {
      return null;
    }
  }

  if (item.items && item.items.length > 0) {
    const filteredSubItems = item.items
      .map((subItem) =>
        filterNavItem(subItem as any, userRoles, userPermissions),
      )
      .filter((subItem: any): subItem is PluginNavElement => subItem !== null);

    return {
      ...item,
      items: filteredSubItems as any,
    };
  }

  return item;
}

/**
 * Navigation use cases. Depends on the bound plugins context, the auth
 * context and the config port - no container lookups.
 */
@Injectable()
export class NavigationService {
  constructor(
    private readonly registry: PluginRegistry,
    @Inject(VEAP_CONFIG) private readonly config: IVeapConfigProvider,
  ) {}

  public async getPathPrefix(): Promise<string> {
    const config = await this.config.get();
    return config.privatePath ?? "/app";
  }

  public async getNavigationGrouped(type: "admin" | "settings") {
    const { user } = await authContext().session.getCurrentSession();
    const userRoles = user?.roles || [];
    const userPermissions = user?.permissions || [];

    const plugins = this.registry.getEnabledPlugins();
    const groups: Record<string, PluginNavElement[]> = {};
    const groupPriorities: Record<string, number> = {};

    for (const plugin of plugins) {
      try {
        const pluginNav = plugin.navigation?.[type];
        if (pluginNav) {
          for (const [groupName, groupData] of Object.entries(
            pluginNav as PluginNavigationGroupMap,
          )) {
            if (!groups[groupName]) groups[groupName] = [];

            let items: PluginNavElement[] = [];
            if (Array.isArray(groupData)) {
              items = groupData;
            } else {
              items = groupData.items;
              if (
                groupData.priority !== undefined &&
                (groupPriorities[groupName] === undefined ||
                  groupData.priority < groupPriorities[groupName])
              ) {
                groupPriorities[groupName] = groupData.priority;
              }
            }

            for (const rawItem of items) {
              const item = filterNavItem(rawItem, userRoles, userPermissions);
              if (
                item &&
                !groups[groupName].some((existing) => existing.url === item.url)
              ) {
                groups[groupName].push(item);
              }
            }
          }
        }
      } catch (_e) {
        console.warn(
          `[Kernel:Navigation] Failed to load navigation for plugin ${plugin.manifest.id}:`,
          _e,
        );
      }
    }

    const sortNavItems = (items: PluginNavElement[]) => {
      // Sort items by priority first, then by title
      items.sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
      // Sort items by title
      // items.sort((a, b) => a.title.localeCompare(b.title));

      for (const item of items) {
        if (item.items && item.items.length > 0) {
          sortNavItems(item.items as PluginNavElement[]);
        }
      }
    };

    for (const groupName in groups) {
      sortNavItems(groups[groupName]);
    }

    return { groups, groupPriorities };
  }

  public async getVeapNavigationGrouped(type: "admin" | "settings") {
    const { groups, groupPriorities } = await this.getNavigationGrouped(type);
    const prefix = await this.getPathPrefix();

    const prefixUrl = (url: string) => {
      if (url.startsWith(prefix)) return url;
      return url === "/" ? prefix : `${prefix}${url}`;
    };

    const processItems = (items: PluginNavElement[]): PluginNavElement[] => {
      return items.map((item) => ({
        ...item,
        url: prefixUrl(item.url),
        items: item.items
          ? processItems(item.items as PluginNavElement[])
          : undefined,
      })) as PluginNavElement[];
    };

    const transformedGroups: Record<string, PluginNavElement[]> = {};

    const sortedGroupNames = Object.keys(groups).sort((a, b) => {
      const prioA = groupPriorities[a] ?? 1000;
      const prioB = groupPriorities[b] ?? 1000;
      if (prioA !== prioB) return prioA - prioB;
      return a.localeCompare(b);
    });

    for (const groupName of sortedGroupNames) {
      transformedGroups[groupName] = processItems(groups[groupName]);
    }

    return transformedGroups;
  }

  public async getPublicNavigation(): Promise<PluginNavElement[]> {
    const { user } = await authContext().session.getCurrentSession();
    const userRoles = user?.roles || [];
    const userPermissions = user?.permissions || [];

    const plugins = this.registry.getEnabledPlugins();
    const all: PluginNavElement[] = [];

    for (const plugin of plugins) {
      try {
        if (plugin.navigation?.["public"]) {
          const items = plugin.navigation["public"] as PluginNavElement[];
          for (const rawItem of items) {
            const item = filterNavItem(rawItem, userRoles, userPermissions);
            if (item) all.push(item);
          }
        }
      } catch {}
    }

    // Sort public navigation items by priority
    all.sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
    // Sort public navigation items by title
    all.sort((a, b) => a.title.localeCompare(b.title));

    return all;
  }
}

// ─── Module-level API (composition-bound) ────────────────────────────────────

export async function getPathPrefix(): Promise<string> {
  return pluginsContext().navigation.getPathPrefix();
}

export async function getPluginNavigationGrouped(type: "admin" | "settings") {
  return pluginsContext().navigation.getNavigationGrouped(type);
}

export async function getVeapPluginNavigationGrouped(
  type: "admin" | "settings",
) {
  return pluginsContext().navigation.getVeapNavigationGrouped(type);
}

export async function getPluginNavigation(
  type: "public" = "public",
): Promise<PluginNavElement[]> {
  return pluginsContext().navigation.getPublicNavigation();
}
