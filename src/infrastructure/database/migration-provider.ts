import { ServiceProvider } from "../../infrastructure/providers/service-provider";
import { runMigrations } from "./orm/migrations/runner";
import { coreMigrations } from "./migrations/index";

export class MigrationServiceProvider extends ServiceProvider {
  register(): void {
    // No bindings needed
  }

  async boot(): Promise<void> {
    // 1. Run core migrations
    await runMigrations("core", coreMigrations);

    // 2. Run app migrations if injected into container
    if (this.container.has("AppMigrations")) {
      const appMigrations =
        await this.container.resolve<any[]>("AppMigrations");
      if (appMigrations?.length) {
        await runMigrations("app", appMigrations);
      }
    }

    if (this.container.has("CliService")) {
      const cliService = await this.container.resolve<any>("CliService");
      const cli = cliService.program;

      cli
        .command(
          "make:migration <name>",
          "Generate a new native app migration (e.g., create_users_table)",
        )
        .action(async (name: string) => {
          const { generateMigration } = await import(
            /* webpackIgnore: true */ "./cli/generate-migration.js"
          );
          await generateMigration(name);
        });
    }
  }
}
