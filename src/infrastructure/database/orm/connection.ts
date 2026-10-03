import { AsyncLocalStorage } from "node:async_hooks";
import fs from "node:fs";
import path from "node:path";
import knex, { type Knex } from "knex";
import { AppError } from "../../../domain/errors/app-error";
import { debug, warn } from "../../logging";

export interface DatabaseConfig extends Knex.Config {
  driver?: "postgres" | "sqlite" | "mysql";
}

const globalForDb = globalThis as any;

/**
 * AsyncLocalStorage holding the currently active Knex transaction for the asynchronous execution context.
 */
export const transactionStorage: AsyncLocalStorage<Knex.Transaction> =
  globalForDb.__VEAP_TRANSACTION_STORAGE__ ||
  (globalForDb.__VEAP_TRANSACTION_STORAGE__ = new AsyncLocalStorage<Knex.Transaction>());

/**
 * Returns the currently active transaction if inside a transaction() callback.
 */
export function getActiveTransaction(): Knex.Transaction | undefined {
  return transactionStorage.getStore();
}

/**
 * Injects or overrides the global Knex database instance.
 */
export function setKnex(instance: Knex): Knex {
  globalForDb.__VEAP_KNEX__ = instance;
  debug("veap:database", "Knex database instance registered.");
  return instance;
}

export function isSqliteDatabase(url?: string): boolean {
  if (!url) return false;
  return (
    url.startsWith("sqlite:") ||
    url.startsWith("file:") ||
    url.endsWith(".sqlite") ||
    url.endsWith(".db")
  );
}

export interface PostgresSslOptions {
  databaseUrl: string;
  isProd: boolean;
  rejectUnauthorizedEnv?: string;
  caCert?: string;
}

export type PostgresSslConfig =
  | false
  | {
      rejectUnauthorized: boolean;
      ca?: string;
    };

/**
 * Resolves PostgreSQL TLS/SSL configuration based on environment, connection string parameters,
 * and security settings.
 *
 * Rules:
 * - If `sslmode=disable` is present in `databaseUrl`, TLS is disabled (`false`).
 * - TLS is enabled if `isProd` is true, or if `databaseUrl` explicitly requests it (`sslmode=require`, `ssl=true`, `sslmode=no-verify`).
 * - Certificate verification (`rejectUnauthorized`):
 *   - Defaults to `true` in production (secure by default, protecting against MITM attacks).
 *   - Can be explicitly disabled via `DATABASE_SSL_REJECT_UNAUTHORIZED="false"` (or `"0"`),
 *     or via URL parameters: `sslmode=no-verify` or `rejectUnauthorized=false`.
 * - Custom CA bundle can be passed via `caCert` (e.g. from `DATABASE_SSL_CA`).
 */
export function resolvePostgresSslConfig(options: PostgresSslOptions): PostgresSslConfig {
  const { databaseUrl, isProd, rejectUnauthorizedEnv, caCert } = options;

  if (databaseUrl.includes("sslmode=disable")) {
    return false;
  }

  const isSslRequested =
    isProd ||
    databaseUrl.includes("sslmode=require") ||
    databaseUrl.includes("ssl=true") ||
    databaseUrl.includes("sslmode=no-verify");

  if (!isSslRequested) {
    return false;
  }

  let rejectUnauthorized = true;

  if (rejectUnauthorizedEnv !== undefined) {
    rejectUnauthorized = rejectUnauthorizedEnv !== "false" && rejectUnauthorizedEnv !== "0";
  } else if (
    databaseUrl.includes("sslmode=no-verify") ||
    databaseUrl.includes("rejectUnauthorized=false")
  ) {
    rejectUnauthorized = false;
  }

  const sslConfig: { rejectUnauthorized: boolean; ca?: string } = {
    rejectUnauthorized,
  };

  if (caCert) {
    sslConfig.ca = caCert;
  }

  return sslConfig;
}

/**
 * Resolves SQLite database filename, automatically redirecting to /tmp on serverless (Vercel/Lambda)
 * where the root deployment filesystem is read-only.
 *
 * Accepts all common URL forms (`sqlite:./path.db`, `sqlite://./path.db`,
 * `file:./path.db`, `file://./path.db`) plus bare filenames, and ensures the
 * parent directory exists (better-sqlite3 refuses to create it, which broke
 * generated projects whose `storage/` dir is git-ignored and missing on
 * fresh clones).
 */
export function resolveSqliteFilename(filename: string): string {
  let clean = filename.replace(/^(?:sqlite|file):(\/\/)?/, "");
  if (!clean) clean = "veap.sqlite";

  const isServerless =
    process.env.VERCEL === "1" ||
    !!process.env.AWS_LAMBDA_FUNCTION_NAME ||
    !!process.env.LAMBDA_TASK_ROOT;

  if (isServerless && !clean.startsWith("/tmp") && !clean.startsWith(":memory:")) {
    const base = clean.split(/[\/\\]/).pop() || "dev.sqlite";
    const redirected = `/tmp/${base}`;
    warn(
      "veap:database",
      `Running SQLite on Vercel/Serverless environment where filesystem (/var/task) is read-only. ` +
        `Redirecting SQLite database file from "${clean}" to writable temporary path "${redirected}". ` +
        `WARNING: SQLite storage on serverless functions is ephemeral and wiped across function cold starts. ` +
        `For persistent production deployments on Vercel, set a PostgreSQL DATABASE_URL in Vercel Environment Variables.`,
    );
    return redirected;
  }

  if (!clean.startsWith(":memory:")) {
    // better-sqlite3 does not create missing directories. Relative paths
    // resolve against the process working directory, same as before.
    try {
      fs.mkdirSync(path.dirname(path.resolve(/*turbopackIgnore: true*/ clean)), {
        recursive: true,
      });
    } catch {
      // Read-only filesystem etc. Let the driver surface its own error.
    }
  }

  return clean;
}

/**
 * Initializes a new Knex instance from a configuration object.
 */
export function initDatabase(config: DatabaseConfig): Knex {
  // Normalize driver shortcuts
  let client = config.client;
  if (!client && config.driver) {
    if (config.driver === "postgres") client = "pg";
    else if (config.driver === "sqlite") client = "better-sqlite3";
    else if (config.driver === "mysql") client = "mysql2";
  }

  if (
    (client === "better-sqlite3" || config.driver === "sqlite") &&
    typeof config.connection === "object" &&
    config.connection !== null
  ) {
    const conn = config.connection as any;
    if (conn.filename) {
      conn.filename = resolveSqliteFilename(conn.filename);
    }
  }

  const finalConfig: Knex.Config = {
    ...config,
    client: client || "pg",
    useNullAsDefault: config.useNullAsDefault ?? true,
  };

  const instance = knex(finalConfig);
  return setKnex(instance);
}

import { app } from "../../../infrastructure/ioc/container";

/**
 * Returns the active Knex database instance or active transaction if inside a transaction context.
 * If not explicitly registered yet, attempts auto-initialization from environment variables.
 */
export function getKnex(): Knex {
  const activeTrx = getActiveTransaction();
  if (activeTrx) {
    return activeTrx as unknown as Knex;
  }

  if (globalForDb.__VEAP_KNEX__) {
    return globalForDb.__VEAP_KNEX__;
  }

  throw AppError.Internal(
    "[veap:ORM] Database not initialized. Please ensure DatabaseServiceProvider is registered.",
  );
}

/**
 * Dynamic proxy for knex queries.
 * Can be called as a function: knex('users').where(...)
 * or accessed via properties: knex.schema, knex.raw, knex.transaction
 */
export const dbClient: Knex = new Proxy((() => {}) as any, {
  apply(_target, _thisArg, argArray) {
    const k = getKnex();
    return (k as any)(...argArray);
  },
  get(_target, prop) {
    const k = getKnex();
    const value = (k as any)[prop];
    return typeof value === "function" ? value.bind(k) : value;
  },
});

export interface TransactionOptions {
  /**
   * When true and called inside an existing transaction, creates a SAVEPOINT
   * instead of reusing the outer transaction directly. This allows catching
   * errors in the inner transaction without aborting the outer transaction.
   *
   * @default false (Propagation: REQUIRED - reuses outer transaction)
   */
  savepoint?: boolean;
}

/**
 * Executes a callback within a database transaction managed via AsyncLocalStorage.
 * Automatically commits if callback succeeds, and rolls back if an error is thrown.
 *
 * Propagation semantics:
 * - By default (options.savepoint = false), nested calls participate in the outer
 *   transaction (Propagation: REQUIRED). Any unhandled error rolls back the entire transaction.
 * - When options.savepoint = true and an outer transaction exists, a database SAVEPOINT is
 *   created. Errors caught around the inner transaction only roll back to that SAVEPOINT,
 *   allowing the outer transaction to continue.
 */
export async function transaction<T>(
  callback: (trx: Knex.Transaction) => Promise<T>,
  options?: TransactionOptions,
): Promise<T> {
  const currentTrx = getActiveTransaction();
  if (currentTrx) {
    if (options?.savepoint) {
      // Nested savepoint support: creates a SAVEPOINT on the active transaction
      return await currentTrx.transaction(async (spTrx) => {
        return await transactionStorage.run(spTrx, async () => {
          return await callback(spTrx);
        });
      });
    }

    // Default: Propagation REQUIRED (reuse current transaction)
    return await callback(currentTrx);
  }

  const knex = getKnex();
  return await knex.transaction(async (trx) => {
    return await transactionStorage.run(trx, async () => {
      return await callback(trx);
    });
  });
}
