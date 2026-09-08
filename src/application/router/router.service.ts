import { Injectable, Inject } from "../../domain/contracts/ioc";
import { PluginRegistry } from "../plugins/registry";
import { RouteTree, resolveMagicPrefix } from "./route-tree";
import { NavigationService } from "../plugins/navigation";
import { CACHE_PROVIDER, CONFIG_SERVICE } from "../../domain/contracts";
import type { ICacheProvider } from "../../domain/contracts/cache";
import type { IConfigService } from "../../domain/contracts/config";

@Injectable()
export class RouterService {
  constructor(
    @Inject(CACHE_PROVIDER) private cache: ICacheProvider,
    @Inject(CONFIG_SERVICE) private config: IConfigService,
    private pluginRegistry: PluginRegistry,
    private navigation: NavigationService,
  ) {}

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
