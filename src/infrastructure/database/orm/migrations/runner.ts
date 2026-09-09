import { debug, warn } from "../../../logging";
import { getKnex } from "../connection";
import { Schema } from "./schema-builder";

export interface Migration {
  name: string;
  up: (db: any, schema: Schema) => Promise<void>;
  down?: (db: any, schema: Schema) => Promise<void>;
}

async function ensureMigrationsTable(knex = getKnex()) {
  try {
    const hasTable = await knex.schema.hasTable("migrations");
    if (!hasTable) {
      await knex.schema.createTable("migrations", (table) => {
        table.text("id").primary();
        table.text("name").notNullable();
        table.integer("batch").notNullable();
        table.timestamp("executed_at").defaultTo(knex.fn.now()).notNullable();
        table.text("scope").notNullable().defaultTo("global");
      });
    } else {
      const hasScope = await knex.schema.hasColumn("migrations", "scope");
      if (!hasScope) {
        await knex.schema.alterTable("migrations", (table) => {
          table.text("scope").notNullable().defaultTo("global");
        });
      }
    }
  } catch (error) {
    warn("veap:migration", "Failed to ensure migrations table:", error);
  }
}

/**
 * Creates a compatibility DB adapter for migrations that provides `.execute(query)`
 * wrapping `trx.raw(query)`, while also being directly callable as a Knex query builder
 * on the active migration transaction `trx(tableName)`.
 */
function createMigrationDbAdapter(trx: any) {
  const adapter = (tableName: string) => trx(tableName);
  adapter.raw = (query: any, ...bindings: any[]) => trx.raw(query, ...bindings);
  adapter.execute = (query: any) => {
    const sqlString =
      typeof query === "string"
        ? query
        : query?.query || query?.text || String(query);
    return trx.raw(sqlString);
  };
  return new Proxy(adapter, {
    get(target, prop, receiver) {
      if (prop in target) {
        return Reflect.get(target, prop, receiver);
      }
      return Reflect.get(trx, prop);
    },
    apply(target, thisArg, argArray) {
      return (trx as any)(...argArray);
    },
  });
}

export async function runMigrations(scope: string, migrations: Migration[]) {
  if (migrations.length === 0 || !process.env.DATABASE_URL) return;

  const knex = getKnex();
  await ensureMigrationsTable(knex);

  await knex.transaction(async (tx) => {
    // Acquire advisory lock (unique ID for migrations in Postgres)
    const lockId = 123456;
    try {
      await tx.raw("SELECT pg_advisory_xact_lock(?)", [lockId]);
    } catch (_e) {
      debug("veap:migration", "Could not acquire advisory lock, continuing...");
    }

    debug("veap:migration", `Running migrations for scope: ${scope}`);

    // 1. Get executed migrations for this scope
    const executed = await tx("migrations")
      .select("name")
      .where("scope", scope);

    const executedNames = executed.map((m: any) => m.name);

    // 2. Find pending migrations
    const pending = migrations.filter((m) => !executedNames.includes(m.name));

    if (pending.length === 0) {
      debug("veap:migration", `No new migrations for ${scope}.`);
      return;
    }

    // 3. Get next batch number
    const batchResult = await tx("migrations").max("batch as maxBatch").first();
    const batch = (Number((batchResult as any)?.maxBatch) || 0) + 1;

    const dbAdapter = createMigrationDbAdapter(tx);
    const schema = new Schema(tx);

    // 4. Execute pending
    for (const migration of pending) {
      debug(
        "veap:migration",
        `[${scope}] Running migration: ${migration.name}...`,
      );

      try {
        await migration.up(dbAdapter, schema);
        await tx("migrations").insert({
          id: crypto.randomUUID(),
          name: migration.name,
          scope: scope,
          batch: batch,
          executed_at: new Date(),
        });

        debug(
          "veap:migration",
          `[${scope}] Successfully ran ${migration.name}.`,
        );
      } catch (error) {
        warn(
          "veap:migration",
          `[${scope}] Failed to run ${migration.name}:`,
          error,
        );
        throw error; // Rollback the whole batch on error
      }
    }
  });
}

/**
 * Modern static migration rollback runner.
 * Reverts migrations in reverse order.
 */
export async function rollbackMigrations(
  scope: string,
  migrations: Migration[],
) {
  if (migrations.length === 0 || !process.env.DATABASE_URL) return;

  const knex = getKnex();
  await ensureMigrationsTable(knex);

  await knex.transaction(async (tx) => {
    // Acquire advisory lock
    const lockId = 123456;
    try {
      await tx.raw("SELECT pg_advisory_xact_lock(?)", [lockId]);
    } catch (_e) {
      warn("veap:migration", "Could not acquire advisory lock for rollback.");
    }

    debug("veap:migration", `Rolling back migrations for scope: ${scope}`);

    // 1. Get executed migrations for this scope, ordered by batch and name descending
    const executed = await tx("migrations")
      .select("name")
      .where("scope", scope)
      .orderBy("batch", "desc")
      .orderBy("name", "desc");

    const executedNames = executed.map((m: any) => m.name);

    // 2. Find migrations to roll back
    const toRollback = [...migrations]
      .filter((m) => executedNames.includes(m.name))
      .sort(
        (a, b) => executedNames.indexOf(a.name) - executedNames.indexOf(b.name),
      );

    if (toRollback.length === 0) {
      debug("veap:migration", `No migrations to roll back for ${scope}.`);
      return;
    }

    const dbAdapter = createMigrationDbAdapter(tx);
    const schema = new Schema(tx);

    // 3. Execute rollbacks
    for (const migration of toRollback) {
      if (!migration.down) {
        debug(
          "veap:migration",
          `Migration ${migration.name} has no down() method. Skipping rollback.`,
        );
        await tx("migrations")
          .where({
            scope: scope,
            name: migration.name,
          })
          .delete();
        continue;
      }

      debug("veap:migration", `Rolling back migration: ${migration.name}...`);

      try {
        await migration.down(dbAdapter, schema);
        await tx("migrations")
          .where({
            scope: scope,
            name: migration.name,
          })
          .delete();
        debug("veap:migration", `Successfully rolled back ${migration.name}.`);
      } catch (error) {
        warn("veap:migration", `Failed to rollback ${migration.name}:`, error);
        throw error;
      }
    }
  });
}
