import type * as React from "react";
import { CACHE_PROVIDER, CONFIG_SERVICE } from "../../domain/contracts";
import type { ICacheProvider } from "../../domain/contracts/cache";
import type { IConfigService } from "../../domain/contracts/config";
import { Inject, Injectable } from "../../domain/contracts/ioc";
import { NavigationService } from "../plugins/navigation";
import { PluginRegistry } from "../plugins/registry";
import { RouteTree, resolveMagicPrefix } from "./route-tree";

@Injectable()
export class RouterService {
  private rewrites = new Map<string, string>();
  private siteLayout?: React.ComponentType<any>;

  constructor(
    @Inject(CACHE_PROVIDER) private cache: ICacheProvider,
    @Inject(CONFIG_SERVICE) private config: IConfigService,
    private pluginRegistry: PluginRegistry,
    private navigation: NavigationService,
  ) {}

  public setSiteLayout(layout: React.ComponentType<any>): void {
    this.siteLayout = layout;
  }

  public getSiteLayout(): React.ComponentType<any> | undefined {
    return this.siteLayout;
  }

  public addRewrite(from: string, to: string): void {
    this.rewrites.set(from, to);
  }

  public getRewrites(): Map<string, string> {
    return new Map(this.rewrites);
  }

  public async clearCache(): Promise<void> {
    await this.cache.delete("router:tree");
  }

  public async getPluginsWithHomepage(): Promise<
    { id: string; name: string }[]
  > {
    await this.pluginRegistry.init();
    const plugins = this.pluginRegistry.getEnabledPlugins();
    const result: { id: string; name: string }[] = [];

    for (const plugin of plugins) {
      let hasHomepage = false;

      if (plugin.routeTree) {
        const pluginTree =
          typeof plugin.routeTree === "function"
            ? await plugin.routeTree()
            : plugin.routeTree;

        const tempTree = new RouteTree();
        if (pluginTree instanceof RouteTree) {
          tempTree.addTree(pluginTree.getRoot());
        } else {
          tempTree.addTree(pluginTree as any);
        }

        const match = tempTree.match("/");
        if (match?.isExact) {
          hasHomepage = true;
        }
      }

      if (hasHomepage) {
        result.push({ id: plugin.manifest.id, name: plugin.manifest.name });
      }
    }

    return result;
  }

  private async _buildRouteTree(_options?: {
    includePrivate?: boolean;
  }): Promise<RouteTree> {
    const tree = new RouteTree();
    tree.setRewrites(this.rewrites);
    await this.pluginRegistry.init();
    const plugins = this.pluginRegistry.getEnabledPlugins();
    const prefix = await this.navigation.getPathPrefix();

    for (const plugin of plugins) {
      if (plugin.routeTree) {
        let pluginTree =
          typeof plugin.routeTree === "function"
            ? await plugin.routeTree()
            : plugin.routeTree;

        if (pluginTree instanceof RouteTree) pluginTree = pluginTree.getRoot();

        const resolvedTreeRoot = resolveMagicPrefix(pluginTree as any, prefix);
        tree.addTree(resolvedTreeRoot);
      }
    }

    // Attach siteLayout only to the "(site)" route group node
    if (this.siteLayout) {
      const rootNode = tree.getRoot();
      if (!rootNode.children) rootNode.children = [];

      let siteGroup = rootNode.children.find((c) => c.segment === "(site)");
      if (!siteGroup) {
        siteGroup = { segment: "(site)", children: [] };
        rootNode.children.push(siteGroup);
      }
      siteGroup.layout = this.siteLayout;
    }

    return tree;
  }

  public async buildRouteTree(
    includePrivate: boolean = false,
  ): Promise<RouteTree> {
    const isProd = this.config.get("NODE_ENV") === "production";
    if (isProd) {
      const cached = await this.cache.get<RouteTree>("router:tree");
      if (cached) return cached;
    }

    const tree = await this._buildRouteTree({ includePrivate });

    if (isProd) {
      await this.cache.set("router:tree", tree);
    }

    return tree;
  }
}
