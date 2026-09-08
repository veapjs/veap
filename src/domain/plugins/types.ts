import type { SystemEvent } from "../events/types";
import type { UserPermission, UserRole } from "../auth/types";

export type { SystemEvent };

import type * as React from "react";
import { z } from "zod";

export type SidebarGroupType = {
  title: string;
  items: SidebarMenuType;
};

export type SidebarMenuItemType<T = Record<string, string>> = {
  id?: string;
  title: string;
  icon?: string;
  url: string;
  roles?: string[];
  permissions?: string[];
  priority?: number;
  badge?: string | number | null | undefined;
  badgeVariant?:
    "default" | "secondary" | "destructive" | "outline" | null | undefined;
} & T;

export type SidebarMenuType = SidebarMenuItemType<{
  items?: SidebarMenuItemType<{
    items?: SidebarMenuItemType[];
  }>[];
}>[];

export const PluginManifestSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  description: z.string().optional(),
  dependencies: z.array(z.string()).default([]),
  extends: z.array(z.string()).default([]),
  enabled: z.boolean().default(true),
  system: z.boolean().default(false),
  hasSetup: z.boolean().default(false),
  author: z.string().optional(),
});

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  dependencies?: string[];
  extends?: string[];
  enabled?: boolean;
  system?: boolean;
  hasSetup?: boolean;
  author?: string;
  [key: string]: any;
}

/**
 * Shape of the `veap` field in a plugin or template `package.json`.
 * This replaces the standalone `manifest.json` file.
 */
export interface VeapPackageMetadata {
  type?: string;
  id?: string;
  name?: string;
  description?: string;
  enabled?: boolean;
  system?: boolean;
  hasSetup?: boolean;
  dependencies?: string[];
  extends?: string[];
  isNpm?: boolean;
  author?: string;
  [key: string]: any;
}

/**
 * Shape of the `package.json` for a Veap plugin or template.
 */
export interface VeapPackageJson {
  name: string;
  version: string;
  description?: string;
  veap?: VeapPackageMetadata;
  [key: string]: any;
}

/**
 * Helper to build a `PluginManifest` from a `package.json` import.
 * Eliminates the need for a standalone `manifest.json` file.
 *
 * @example
 * ```ts
 * import pkg from "../package.json" with { type: "json" };
 * import { createManifestFromPackageJson } from "@veap/core/plugins";
 * const manifest = createManifestFromPackageJson(pkg);
 * ```
 */
export function createManifestFromPackageJson(
  pkg: VeapPackageJson,
): PluginManifest {
  const meta: VeapPackageMetadata = pkg.veap || ({} as VeapPackageMetadata);
  return {
    id: meta.id || pkg.name.replace(/^@[^/]+\//, ""),
    name: meta.name || pkg.name,
    version: pkg.version,
    description: meta.description || pkg.description,
    enabled: meta.enabled ?? true,
    system: meta.system ?? false,
    hasSetup: meta.hasSetup ?? false,
    dependencies: meta.dependencies || [],
    extends: meta.extends || [],
    isNpm: meta.isNpm ?? true,
    author: meta.author,
  };
}

export interface PluginHook {
  point: string;
  handler: (data: any, context?: any) => Promise<any> | any;
  priority?: number;
}

export interface PluginExtension {
  id: string;
  target: string;
  point: string;
  component: React.ComponentType<any>;
  priority?: number;
  metadata?: any;
  roles?: string[];
  permissions?: string[];
}

export interface PluginWidget {
  id: string;
  name: string;
  area: string; // e.g., "dashboard-stats", "dashboard-main"
  component: React.ComponentType<any>;
  priority?: number;
  defaultColSpan?: number;
  defaultRowSpan?: number;
  roles?: string[];
  permissions?: string[];
}

export interface PluginPageProps {
  params: any;
  searchParams: any;
  context?: VeapMiddlewareContext;
}

export interface VeapMiddlewareContext {
  params: any;
  searchParams: any;
  path: string;
  roles?: UserRole[];
  permissions?: UserPermission[];
  [key: string]: any;
}

export type VeapMiddleware = (
  context: VeapMiddlewareContext,
  next: () => Promise<React.ReactNode>,
) => Promise<React.ReactNode>;

export interface BreadcrumbItem {
  label: string;
  href?: string;
  id?: string;
}

export type BreadcrumbValue =
  | string
  | ((
      props: PluginPageProps,
    ) =>
      | Promise<string | BreadcrumbItem | BreadcrumbItem[]>
      | string
      | BreadcrumbItem
      | BreadcrumbItem[]);

export type PluginNavElement = SidebarMenuItemType<{
  items?: SidebarMenuItemType<{
    items?: SidebarMenuItemType[];
  }>[];
}>;

export interface PluginNavigationGroupDefinition {
  title?: string;
  priority?: number;
  items: PluginNavElement[];
}

export type PluginNavigationGroupMap = Record<
  string,
  PluginNavElement[] | PluginNavigationGroupDefinition
>;

export type ModuleNavigation = PluginNavigation;
export type ModuleNavElement = PluginNavElement;
export type ModuleManifest = PluginManifest;

export type ApiMiddleware = (
  request: Request,
  context: any,
  next: () => Promise<Response>,
) => Promise<Response>;

export interface PluginNavigation {
  public?: PluginNavElement[];
  admin?: PluginNavigationGroupMap;
  settings?: PluginNavigationGroupMap;
}

export interface ITemplate<TConfig = any> {
  id: string;
  name: string;
  description?: string;
  version: string;
  author?: string;
  thumbnail?: string;

  /**
   * Locale message loaders, keyed by locale code (e.g. "en", "pl").
   * Merged into the global message dictionary by the intl discovery loader.
   */
  locales?: Record<string, () => Promise<{ default: any }>>;

  layout: React.ComponentType<{
    children: React.ReactNode;
    config: TConfig;
    breadcrumbs?: BreadcrumbItem[];
  }>;
  overrides?: Record<string, React.ComponentType<any>>;
  configSchema?: any;
  defaultConfig?: TConfig;
}

export interface IPlugin {
  locales?: Record<string, () => Promise<{ default: any }>>;
  manifest: PluginManifest;
  migrations?: any[];
  init?: () => Promise<void> | void;
  onMigrate?: () => Promise<void> | void;
  onEnable?: (context?: any) => Promise<void> | void;
  onDisable?: () => Promise<void> | void;
  hooks?: PluginHook[];
  extensions?: PluginExtension[];
  widgets?: PluginWidget[];
  navigation?: PluginNavigation;
  plugins?: IPlugin[];

  /**
   * App Router-style route tree definition.
   *
   * This is the standard way to define routes for a plugin in Veap.
   * Typically generated dynamically using `discoverRoutes` from the plugin's `app/` directory.
   *
   * Can contain nested layouts, loading/error boundaries, route groups,
   * parallel routes, and dynamic segments.
   *
   * @example
   * ```ts
   * const plugin: IPlugin = {
   *   manifest,
   *   routeTree: async () => {
   *     const { discoverRoutes } = await import("@veap/core/router");
   *     const path = await import("path");
   *     const appDir = path.join(process.cwd(), "plugins", "my-plugin", "src", "app");
   *     return discoverRoutes(appDir, (relPath) => import(`../src/app/${relPath}`));
   *   },
   * };
   * ```
   */
  routeTree?:
    | import("../../application/router/route-tree").RouteNode
    | (() =>
        | Promise<import("../../application/router/route-tree").RouteNode>
        | import("../../application/router/route-tree").RouteNode);
}
