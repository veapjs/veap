"use server";

import { buildRouteTree } from "../router/discovery";
import type {
  BreadcrumbItem,
  BreadcrumbValue,
  PluginNavElement,
  PluginPageProps,
} from "../../domain/plugins/types";
import {
  getVeapPluginNavigationGrouped,
  getPluginNavigation,
} from "./navigation";

async function resolveBreadcrumb(
  value: BreadcrumbValue,
  props: PluginPageProps,
): Promise<BreadcrumbItem | BreadcrumbItem[] | string> {
  if (typeof value === "function") {
    return await value(props);
  }
  return value;
}

async function findInNavigation(url: string): Promise<PluginNavElement | null> {
  const adminNav = await getVeapPluginNavigationGrouped("admin");
  const settingsNav = await getVeapPluginNavigationGrouped("settings");
  const publicNav = await getPluginNavigation("public");

  const allNavItems: PluginNavElement[] = [
    ...Object.values(adminNav).flat(),
    ...Object.values(settingsNav).flat(),
    ...publicNav,
  ];

  const search = (items: PluginNavElement[]): PluginNavElement | null => {
    for (const item of items) {
      if (item.url === url) return item;
      if (item.items) {
        const found = search(item.items as PluginNavElement[]);
        if (found) return found;
      }
    }
    return null;
  };

  return search(allNavItems);
}

export async function getPluginBreadcrumbs(
  path: string,
  searchParams: any = {},
): Promise<BreadcrumbItem[]> {
  const tree = await buildRouteTree(true);

  const segments = path.split("/").filter(Boolean);
  const breadcrumbs: BreadcrumbItem[] = [];

  let currentPath = "";

  for (const segment of segments) {
    currentPath += `/${segment}`;

    const match = tree.match(currentPath);

    if (match?.isExact && match?.node?.breadcrumb) {
      const resolved = await resolveBreadcrumb(match.node.breadcrumb, {
        params: Promise.resolve(match.params || {}),
        searchParams: Promise.resolve(searchParams || {}),
      });
      addResolvedToBreadcrumbs(resolved, currentPath, breadcrumbs);
    } else {
      const navItem = await findInNavigation(currentPath);
      if (navItem) {
        breadcrumbs.push({
          label: navItem.title,
          href: currentPath,
          id: navItem.id,
        });
      }
    }
  }

  const result: BreadcrumbItem[] = [];
  const seenHrefs = new Set<string>();

  for (const bc of breadcrumbs) {
    if (bc.href && seenHrefs.has(bc.href)) {
      const index = result.findIndex((r) => r.href === bc.href);
      if (index !== -1) result[index] = bc;
      continue;
    }
    if (bc.href) seenHrefs.add(bc.href);
    result.push(bc);
  }

  return result.filter((bc) => bc.label);
}

function addResolvedToBreadcrumbs(
  resolved: string | BreadcrumbItem | BreadcrumbItem[],
  href: string,
  breadcrumbs: BreadcrumbItem[],
) {
  if (Array.isArray(resolved)) {
    breadcrumbs.push(...resolved);
  } else if (typeof resolved === "string") {
    breadcrumbs.push({ label: resolved, href });
  } else {
    breadcrumbs.push(resolved);
  }
}
