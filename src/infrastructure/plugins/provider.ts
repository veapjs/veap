import { ServiceProvider } from "../../infrastructure/providers/service-provider";
import { bindPluginsContext } from "../../application/plugins/context";
import { PluginRegistry } from "../../application/plugins/registry";
import { TemplateService } from "../../application/plugins/templates";
import { NavigationService } from "../../application/plugins/navigation";
import {
  PLUGIN_REPOSITORY,
  MIGRATION_RUNNER,
} from "../../domain/plugins/repositories/plugin.repository";
import { TEMPLATE_REPOSITORY } from "../../domain/plugins/repositories/template.repository";
import { ActiveRecordPluginRepository } from "./repositories/active-record-plugin.repository";
import { ActiveRecordTemplateRepository } from "./repositories/active-record-template.repository";
import { KnexMigrationRunner } from "./repositories/knex-migration-runner";
import {
  registerPlugins,
  ensurePluginsInitialized,
} from "../../application/plugins/facade";
import { registerTemplates } from "../../application/plugins/templates";

export class PluginServiceProvider extends ServiceProvider {
  register(): void {
    // Persistence ports → ActiveRecord adapters
    this.container.register({
      token: PLUGIN_REPOSITORY,
      useClass: ActiveRecordPluginRepository,
      singleton: true,
    });

    this.container.register({
      token: TEMPLATE_REPOSITORY,
      useClass: ActiveRecordTemplateRepository,
      singleton: true,
    });

    this.container.register({
      token: MIGRATION_RUNNER,
      useClass: KnexMigrationRunner,
      singleton: true,
    });

    this.container.register({
      token: PluginRegistry,
      useClass: PluginRegistry,
      singleton: true,
    });

    this.container.register({
      token: TemplateService,
      useClass: TemplateService,
      singleton: true,
    });

    this.container.register({
      token: NavigationService,
      useClass: NavigationService,
      singleton: true,
    });
  }

  async boot(): Promise<void> {
    // Bind the plugins context once so facades and sibling services never
    // resolve services through the container themselves.
    bindPluginsContext({
      registry: await this.container.resolve(PluginRegistry),
      templates: await this.container.resolve(TemplateService),
      navigation: await this.container.resolve(NavigationService),
    });

    // Register plugins
    if (this.container.has("AppPlugins")) {
      const appPlugins = await this.container.resolve<any[]>("AppPlugins");
      if (appPlugins?.length) {
        await registerPlugins(appPlugins);
      }
    }

    // Boot plugins
    await ensurePluginsInitialized();

    // Register templates
    if (this.container.has("AppTemplates")) {
      const appTemplates = await this.container.resolve<any[]>("AppTemplates");
      if (appTemplates?.length) {
        await registerTemplates(appTemplates);
      }
    }

    if (this.container.has("CliService")) {
      const cliService = await this.container.resolve<any>("CliService");
      const cli = cliService.program;

      cli
        .command("add <plugin>", "Install and register a Veap plugin")
        .option("--local", "Install as a local plugin (cloning code from Git)")
        .option("--skip-install", "Skip dependencies installation")
        .action(async (plugin: string, options: any) => {
          const { addPlugin } = await import(
            /* webpackIgnore: true */ "./cli/add.js"
          );
          await addPlugin(plugin, options);
        });

      cli
        .command("register", "Regenerate the plugins registry file")
        .action(async () => {
          const { findProjectRoot } = await import(
            /* webpackIgnore: true */ "../../infrastructure/cli/utils.js"
          );
          const { regeneratePluginsRegistry } = await import(
            /* webpackIgnore: true */ "./cli/utils.js"
          );
          const rootDir = findProjectRoot(process.cwd());
          regeneratePluginsRegistry(rootDir);
        });

      cli
        .command(
          "eject <plugin>",
          "Eject an installed plugin to local plugins folder",
        )
        .action(async (plugin: string) => {
          const { ejectPlugin } = await import(
            /* webpackIgnore: true */ "./cli/eject.js"
          );
          await ejectPlugin(plugin);
        });

      cli
        .command(
          "make:plugin <name>",
          "Generate a new plugin with the given name",
        )
        .option("--skip-install", "Skip dependencies installation")
        .action(async (name: string, options: any) => {
          const { generatePlugin } = await import(
            /* webpackIgnore: true */ "./cli/generate-plugin.js"
          );
          await generatePlugin(name, options);
        });

      cli
        .command(
          "make:template <name>",
          "Generate a new template with the given name",
        )
        .option("--skip-install", "Skip dependencies installation")
        .action(async (name: string, options: any) => {
          const { generateTemplate } = await import(
            /* webpackIgnore: true */ "./cli/generate-template.js"
          );
          await generateTemplate(name, options);
        });

      cli
        .command(
          "docker",
          "Initialize Docker configuration (Dockerfile, compose.yml, .dockerignore)",
        )
        .action(async () => {
          const { initDockerConfig } = await import(
            /* webpackIgnore: true */ "../../infrastructure/cli/commands/docker.js"
          );
          await initDockerConfig();
        });
    }
  }
}
