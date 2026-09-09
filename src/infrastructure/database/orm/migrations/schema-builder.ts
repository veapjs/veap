import { getKnex } from "../connection";

/**
 * Lightweight SQL helper for migrations, compatible with sql`...` template strings.
 */
export function sql(
  strings: TemplateStringsArray | string,
  ...values: any[]
): any {
  if (typeof strings === "string") return strings;
  let result = strings[0];
  for (let i = 0; i < values.length; i++) {
    result += values[i] + strings[i + 1];
  }
  return result;
}
sql.raw = (str: string) => str;

export type DatabaseDialect = "postgres" | "sqlite" | "mysql";

export class ColumnBuilder {
  private _notNull = false;
  private _primaryKey = false;
  private _unique = false;
  private _default: any = null;
  private _defaultNow = false;
  private _references: { table: string; column: string } | null = null;
  private _onDelete: string | null = null;
  private _onUpdate: string | null = null;

  constructor(
    public type: string,
    public name: string,
  ) {}

  notNull() {
    this._notNull = true;
    return this;
  }

  primaryKey() {
    this._primaryKey = true;
    return this;
  }

  unique() {
    this._unique = true;
    return this;
  }

  default(value: any) {
    this._default = value;
    return this;
  }

  defaultNow() {
    this._defaultNow = true;
    return this;
  }

  defaultFn(fn: any) {
    // If it's a known function or common pattern, map to SQL
    const fnStr = fn.toString().toLowerCase();
    if (
      fnStr.includes("randomuuid") ||
      fnStr.includes("uuidv4") ||
      fnStr.includes("gen_random_uuid")
    ) {
      this._default = "gen_random_uuid()";
    }
    return this;
  }

  references(table: string, column = "id") {
    this._references = { table, column };
    return this;
  }

  onDelete(action: "CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION") {
    this._onDelete = action;
    return this;
  }

  onUpdate(action: "CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION") {
    this._onUpdate = action;
    return this;
  }

  toSql(dialect: DatabaseDialect = "postgres"): string {
    const isSqlite = dialect === "sqlite";

    // Map types for SQLite if needed
    let colType = this.type;
    if (isSqlite) {
      if (colType === "BYTEA") {
        colType = "BLOB";
      } else if (
        colType.startsWith("TIMESTAMP") ||
        colType.startsWith("DATE") ||
        colType.startsWith("VARCHAR") ||
        colType === "UUID"
      ) {
        colType = "TEXT";
      } else if (colType === "JSONB" || colType === "JSON") {
        colType = "TEXT";
      } else if (colType === "BOOLEAN") {
        colType = "INTEGER";
      } else if (colType === "SERIAL") {
        colType = "INTEGER";
      } else if (colType === "DOUBLE PRECISION" || colType === "DECIMAL") {
        colType = "NUMERIC";
      }
    }

    let sql = `"${this.name}" ${colType}`;

    if (this._primaryKey) {
      if (isSqlite && this.type === "SERIAL") {
        sql = `"${this.name}" INTEGER PRIMARY KEY AUTOINCREMENT`;
        return sql;
      }
      sql += " PRIMARY KEY";
    }

    if (this._notNull) sql += " NOT NULL";
    if (this._unique) sql += " UNIQUE";

    if (this._defaultNow) {
      sql += isSqlite ? " DEFAULT CURRENT_TIMESTAMP" : " DEFAULT NOW()";
    } else if (this._default !== null) {
      if (typeof this._default === "string" && this._default.includes("()")) {
        if (isSqlite && this._default === "gen_random_uuid()") {
          // SQLite doesn't have native gen_random_uuid() built-in by default without extensions
          // Handled via application-level autoUuid
        } else {
          sql += ` DEFAULT ${this._default}`;
        }
      } else if (typeof this._default === "boolean") {
        if (isSqlite) {
          sql += ` DEFAULT ${this._default ? "1" : "0"}`;
        } else {
          sql += ` DEFAULT ${this._default ? "TRUE" : "FALSE"}`;
        }
      } else {
        const val =
          typeof this._default === "string"
            ? `'${this._default}'`
            : this._default;
        sql += ` DEFAULT ${val}`;
      }
    }

    if (this._references) {
      sql += ` REFERENCES "${this._references.table}"("${this._references.column}")`;
      if (this._onDelete) {
        sql += ` ON DELETE ${this._onDelete}`;
      }
      if (this._onUpdate) {
        sql += ` ON UPDATE ${this._onUpdate}`;
      }
    }

    return sql;
  }
}

export class Blueprint {
  private columns: ColumnBuilder[] = [];
  private _primaryKeys: string[] = [];
  private _uniques: string[][] = [];

  constructor(private tableName: string) {}

  id(name = "id") {
    return this.addColumn("SERIAL", name).primaryKey();
  }

  uuid(name = "id") {
    return this.addColumn("UUID", name);
  }

  increments(name: string) {
    return this.addColumn("SERIAL", name).primaryKey();
  }

  text(name: string) {
    return this.addColumn("TEXT", name);
  }

  varchar(name: string, length = 255) {
    return this.addColumn(`VARCHAR(${length})`, name);
  }

  integer(name: string) {
    return this.addColumn("INTEGER", name);
  }

  smallint(name: string) {
    return this.addColumn("SMALLINT", name);
  }

  bigint(name: string) {
    return this.addColumn("BIGINT", name);
  }

  boolean(name: string) {
    return this.addColumn("BOOLEAN", name);
  }

  timestamp(name: string, precision?: number) {
    const type =
      precision !== undefined ? `TIMESTAMP(${precision})` : "TIMESTAMP";
    return this.addColumn(type, name);
  }

  timestamptz(name: string, precision?: number) {
    const type =
      precision !== undefined
        ? `TIMESTAMP(${precision}) WITH TIME ZONE`
        : "TIMESTAMP WITH TIME ZONE";
    return this.addColumn(type, name);
  }

  timestamps() {
    this.timestamp("created_at").defaultNow().notNull();
    this.timestamp("updated_at").defaultNow().notNull();
  }

  softDeletes(name = "deleted_at") {
    return this.timestamp(name);
  }

  date(name: string) {
    return this.addColumn("DATE", name);
  }

  json(name: string) {
    return this.addColumn("JSONB", name);
  }

  jsonb(name: string) {
    return this.addColumn("JSONB", name);
  }

  bytea(name: string) {
    return this.addColumn("BYTEA", name);
  }

  blob(name: string) {
    return this.addColumn("BYTEA", name);
  }

  decimal(name: string, precision?: number, scale?: number) {
    const type =
      precision !== undefined && scale !== undefined
        ? `DECIMAL(${precision}, ${scale})`
        : "DECIMAL";
    return this.addColumn(type, name);
  }

  float(name: string) {
    return this.addColumn("REAL", name);
  }

  double(name: string) {
    return this.addColumn("DOUBLE PRECISION", name);
  }

  custom(type: string, name: string) {
    return this.addColumn(type, name);
  }

  unique(columns: string[]) {
    this._uniques.push(columns);
    return this;
  }

  primary(columns: string[]) {
    this._primaryKeys = columns;
    return this;
  }

  private addColumn(type: string, name: string) {
    const builder = new ColumnBuilder(type, name);
    this.columns.push(builder);
    return builder;
  }

  toSql(dialect: DatabaseDialect = "postgres"): string {
    const isSqlite = dialect === "sqlite";
    const columnDefs = this.columns.map((c) => c.toSql(dialect));

    if (this._primaryKeys.length > 0) {
      if (isSqlite) {
        columnDefs.push(`PRIMARY KEY("${this._primaryKeys.join('", "')}")`);
      } else {
        const pkName = `${this.tableName}_${this._primaryKeys.join("_")}_pk`;
        columnDefs.push(
          `CONSTRAINT "${pkName}" PRIMARY KEY("${this._primaryKeys.join('", "')}")`,
        );
      }
    }

    for (const uniqueCols of this._uniques) {
      if (isSqlite) {
        columnDefs.push(`UNIQUE("${uniqueCols.join('", "')}")`);
      } else {
        const uName = `${this.tableName}_${uniqueCols.join("_")}_uq`;
        columnDefs.push(
          `CONSTRAINT "${uName}" UNIQUE("${uniqueCols.join('", "')}")`,
        );
      }
    }

    return `CREATE TABLE IF NOT EXISTS "${this.tableName}" (${columnDefs.join(", ")})`;
  }

  toAlterSql(dialect: DatabaseDialect = "postgres"): string[] {
    const isSqlite = dialect === "sqlite";
    const sqls = this.columns.map(
      (c) =>
        `ALTER TABLE "${this.tableName}" ADD COLUMN ${isSqlite ? "" : "IF NOT EXISTS "}${c.toSql(dialect)}`,
    );

    for (const uniqueCols of this._uniques) {
      if (isSqlite) {
        const uName = `${this.tableName}_${uniqueCols.join("_")}_uq_idx`;
        sqls.push(
          `CREATE UNIQUE INDEX IF NOT EXISTS "${uName}" ON "${this.tableName}" ("${uniqueCols.join('", "')}")`,
        );
      } else {
        const uName = `${this.tableName}_${uniqueCols.join("_")}_uq`;
        // Use DO block for idempotent constraint addition in Postgres
        sqls.push(`
          DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${uName}') THEN
              ALTER TABLE "${this.tableName}" ADD CONSTRAINT "${uName}" UNIQUE("${uniqueCols.join('", "')}");
            END IF;
          END $$;
        `);
      }
    }

    return sqls;
  }
}

export class Schema {
  constructor(private db?: any) {}

  getDialect(): DatabaseDialect {
    const knex = this.getKnexInstance();
    const clientName = knex?.client?.config?.client || "";
    if (clientName.includes("sqlite")) {
      return "sqlite";
    }
    if (clientName.includes("mysql")) {
      return "mysql";
    }
    return "postgres";
  }

  get knex(): any {
    return this.getKnexInstance();
  }

  private getKnexInstance(): any {
    if (this.db?.client) return this.db;
    return getKnex();
  }

  async hasTable(name: string): Promise<boolean> {
    const knex = this.getKnexInstance();
    return await knex.schema.hasTable(name);
  }

  async hasColumn(tableName: string, columnName: string): Promise<boolean> {
    const dialect = this.getDialect();
    const knex = this.getKnexInstance();
    if (dialect === "sqlite") {
      const result = await knex.raw(`PRAGMA table_info("${tableName}")`);
      const rows = Array.isArray(result) ? result : result?.rows || [];
      return rows.some((r: any) => r.name === columnName);
    }
    return await knex.schema.hasColumn(tableName, columnName);
  }

  async dropColumn(tableName: string, columnName: string): Promise<void> {
    const dialect = this.getDialect();
    const hasCol = await this.hasColumn(tableName, columnName);
    if (!hasCol) return;

    if (dialect === "sqlite") {
      // SQLite rejects ALTER TABLE ... DROP COLUMN for UNIQUE/indexed columns.
      // Knex handles the required table recreation automatically and safely.
      const knex = this.getKnexInstance();
      await knex.schema.alterTable(tableName, (table: any) => {
        table.dropColumn(columnName);
      });
      return;
    }

    await this.runQuery(
      `ALTER TABLE "${tableName}" DROP COLUMN IF EXISTS "${columnName}"`,
    );
  }

  private async runQuery(query: string) {
    if (typeof this.db?.raw === "function") {
      await this.db.raw(query);
    } else if (typeof this.db?.execute === "function") {
      await this.db.execute(query);
    } else {
      const knex = getKnex();
      await knex.raw(query);
    }
  }

  async createTable(name: string, callback: (table: Blueprint) => void) {
    const blueprint = new Blueprint(name);
    callback(blueprint);
    const dialect = this.getDialect();
    const query = blueprint.toSql(dialect);
    await this.runQuery(query);
  }

  async table(name: string, callback: (table: Blueprint) => void) {
    const blueprint = new Blueprint(name);
    callback(blueprint);
    const dialect = this.getDialect();
    const queries = blueprint.toAlterSql(dialect);
    for (const query of queries) {
      await this.runQuery(query);
    }
  }

  async dropTable(name: string) {
    const dialect = this.getDialect();
    const cascade = dialect === "sqlite" ? "" : " CASCADE";
    await this.runQuery(`DROP TABLE IF EXISTS "${name}"${cascade}`);
  }

  async dropTableIfExists(name: string) {
    await this.dropTable(name);
  }

  async createEnum(name: string, values: string[]) {
    const dialect = this.getDialect();
    if (dialect === "sqlite") {
      // SQLite does not support standalone ENUM types; columns use TEXT with check constraints
      return;
    }
    const vals = values.map((v) => `'${v}'`).join(", ");
    await this.runQuery(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '${name}') THEN
          CREATE TYPE "${name}" AS ENUM (${vals});
        END IF;
      END $$;
    `);
  }

  async dropEnum(name: string) {
    const dialect = this.getDialect();
    if (dialect === "sqlite") return;
    await this.runQuery(`DROP TYPE IF EXISTS "${name}" CASCADE`);
  }

  async raw(query: string) {
    await this.runQuery(query);
  }
}
