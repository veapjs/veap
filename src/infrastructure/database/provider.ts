import { ServiceProvider } from "../../infrastructure/providers/service-provider";
import { ConfigService } from "../../infrastructure/config/config.service";
import { DATABASE } from "../../domain/contracts/token";
import {
  initDatabase,
  setKnex,
  isSqliteDatabase,
  resolveSqliteFilename,
} from "./orm/connection";
import knex from "knex";
import { debug } from "../../infrastructure/logging/console-logger";

export class DatabaseServiceProvider extends ServiceProvider {
  register(): void {
    // We bind a factory or value for 'Database'
    // But we also want to execute the global initialization logic.
  }

  async boot(): Promise<void> {
    const config = await this.container.resolve(ConfigService);
    const databaseUrl = config.get("DATABASE_URL");
    const isProd = config.get("NODE_ENV") === "production";

    if (databaseUrl) {
      const isSqlite = isSqliteDatabase(databaseUrl);
      const client = isSqlite ? "better-sqlite3" : "pg";

      debug(
        "veap:database",
        `Auto-initializing Knex from DATABASE_URL with client: ${client}`,
      );

      const instance = knex({
        client,
        connection: isSqlite
          ? { filename: resolveSqliteFilename(databaseUrl) }
          : {
              connectionString: databaseUrl,
              ssl:
                isProd && !databaseUrl.includes("sslmode=disable")
                  ? { rejectUnauthorized: false }
                  : false,
            },
        useNullAsDefault: true,
      });

      // Still setting it globally for backward compatibility with `dbClient` and `transaction()` wrappers.
      setKnex(instance);

      // Register the instance to the IoC container with typed symbol and backward-compatible string token
      this.container.register({
        token: DATABASE,
        useValue: instance,
      });
      this.container.register({
        token: "Knex",
        useValue: instance,
      });
    }
  }
}
