import type { IMigrationRunner } from "../../../domain/plugins/repositories/plugin.repository";
import { rollbackMigrations, runMigrations } from "../../database/orm/migrations/runner";

/**
 * `IMigrationRunner` adapter delegating to the knex-based migration runner.
 */
export class KnexMigrationRunner implements IMigrationRunner {
  run(scope: string, migrations: any[]): Promise<void> {
    return runMigrations(scope, migrations);
  }

  rollback(scope: string, migrations: any[]): Promise<void> {
    return rollbackMigrations(scope, migrations);
  }
}
