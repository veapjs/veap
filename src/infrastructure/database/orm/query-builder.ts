import { AppError } from "../../../domain/errors/app-error";
import type { Knex } from "knex";
import { getKnex } from "./connection";
import type { Model } from "./model";
import { serializeForStorage } from "./casts";
import {
  BelongsTo,
  BelongsToMany,
  HasMany,
  HasOne,
  MorphMany,
  MorphOne,
  MorphToMany,
  MorphedByMany,
} from "./relations";
import { eagerLoadRelations } from "./relations/eager-loader";
import { toCamelCase, toSnakeCase } from "./utils";

export class ModelQueryBuilder<M extends Model = any> {
  [key: string]: any;

  protected knexBuilder: Knex.QueryBuilder;
  protected eagerRelations: string[] = [];
  protected _withTrashed = false;
  protected _onlyTrashed = false;
  protected _softDeleteScopeApplied = false;
  protected _scopesApplied = false;
  protected _ignoredGlobalScopes: Set<string> = new Set();
  protected _ignoreAllGlobalScopes = false;

  constructor(
    public modelClass: any, // typeof Model
    customKnexBuilder?: Knex.QueryBuilder,
  ) {
    const knex = getKnex();
    this.knexBuilder = customKnexBuilder || knex(modelClass.table);

    // Return Proxy to enable dynamic local scope dispatching (e.g. query.active(), query.popular(10))
    return new Proxy(this, {
      get(target, prop, receiver) {
        if (typeof prop === "string") {
          // 1. Direct property or method on ModelQueryBuilder
          if (prop in target) {
            const val = Reflect.get(target, prop, receiver);
            if (typeof val === "function") {
              return (...args: any[]) => {
                const res = val.apply(target, args);
                return res === target ? receiver : res;
              };
            }
            return val;
          }

          // 2. Check for local scope method on modelClass (prototype or static)
          // e.g. "active" -> "scopeActive", "popular" -> "scopePopular"
          const scopeName = `scope${prop.charAt(0).toUpperCase()}${prop.slice(1)}`;
          const proto = target.modelClass?.prototype;
          const fn = proto?.[scopeName] || target.modelClass?.[scopeName];

          if (typeof fn === "function") {
            return (...args: any[]) => {
              const result = fn.call(
                proto || target.modelClass,
                receiver,
                ...args,
              );
              return result === target || result === undefined
                ? receiver
                : result;
            };
          }
        }
        return Reflect.get(target, prop, receiver);
      },
    });
  }

  /**
   * Explicitly applies a local scope method by name.
   */
  scope(name: string, ...args: any[]): this {
    const scopeName = name.startsWith("scope")
      ? name
      : `scope${name.charAt(0).toUpperCase()}${name.slice(1)}`;
    const proto = this.modelClass?.prototype;
    const fn = proto?.[scopeName] || this.modelClass?.[scopeName];

    if (typeof fn !== "function") {
      throw AppError.Internal(
        `[veap:ORM] Scope "${name}" (${scopeName}) not found on model ${this.modelClass?.name || this.modelClass?.table}.`,
      );
    }
    const result = fn.call(proto || this.modelClass, this, ...args);
    return result !== undefined ? result : this;
  }

  /**
   * Excludes a specific global scope from this query.
   */
  withoutGlobalScope(scope: string): this {
    this._ignoredGlobalScopes.add(scope);
    if (scope === "softDeletes" || scope === "softDelete") {
      this.withTrashed();
    }
    return this;
  }

  /**
   * Excludes multiple or all global scopes from this query.
   */
  withoutGlobalScopes(scopes?: string[]): this {
    if (!scopes || scopes.length === 0) {
      this._ignoreAllGlobalScopes = true;
      this.withTrashed();
    } else {
      for (const s of scopes) {
        this.withoutGlobalScope(s);
      }
    }
    return this;
  }

  /**
   * Includes soft-deleted models in query results.
   */
  withTrashed(): this {
    this._withTrashed = true;
    this._onlyTrashed = false;
    return this;
  }

  /**
   * Restricts query to only soft-deleted models.
   */
  onlyTrashed(): this {
    this._onlyTrashed = true;
    this._withTrashed = false;
    return this;
  }

  /**
   * Applies both user-defined global scopes and soft-delete scope.
   */
  protected applyGlobalScopes(): void {
    if (this._scopesApplied) {
      return;
    }
    this._scopesApplied = true;

    // 1. User-defined global scopes from modelClass
    if (!this._ignoreAllGlobalScopes && this.modelClass) {
      const globalScopes =
        typeof this.modelClass.getGlobalScopes === "function"
          ? this.modelClass.getGlobalScopes()
          : this.modelClass.globalScopes || {};

      for (const [name, scope] of Object.entries(globalScopes)) {
        if (!this._ignoredGlobalScopes.has(name)) {
          if (typeof scope === "function") {
            (scope as any)(this, this.modelClass);
          } else if (scope && typeof (scope as any).apply === "function") {
            (scope as any).apply(this, this.modelClass);
          }
        }
      }
    }

    // 2. Soft deletes
    this.applySoftDeleteScope();
  }

  /**
   * Applies the soft delete filter to the underlying query if enabled.
   */
  protected applySoftDeleteScope(): void {
    if (this._softDeleteScopeApplied || !this.modelClass?.softDeletes) {
      return;
    }

    const colName = toSnakeCase(
      this.modelClass.deletedAtColumn || "deleted_at",
    );
    const column = this.modelClass?.table
      ? `${this.modelClass.table}.${colName}`
      : colName;

    if (this._onlyTrashed) {
      this.knexBuilder.whereNotNull(column);
    } else if (!this._withTrashed) {
      this.knexBuilder.whereNull(column);
    }

    this._softDeleteScopeApplied = true;
  }

  /**
   * Returns the underlying Knex query builder.
   */
  toKnex(): Knex.QueryBuilder {
    return this.knexBuilder;
  }

  /**
   * Basic WHERE clause. Automatically maps camelCase to snake_case columns.
   */
  where(column: any, operator?: any, value?: any): this {
    if (typeof column === "function") {
      this.knexBuilder.where(column);
    } else if (typeof column === "object" && column !== null) {
      const converted: Record<string, any> = {};
      for (const [k, v] of Object.entries(column)) {
        converted[toSnakeCase(k)] = v;
      }
      this.knexBuilder.where(converted);
    } else if (typeof column === "string") {
      const col = toSnakeCase(column);
      if (value === undefined) {
        this.knexBuilder.where(col, operator);
      } else {
        this.knexBuilder.where(col, operator, value);
      }
    } else {
      this.knexBuilder.where(column, operator, value);
    }
    return this;
  }

  orWhere(column: any, operator?: any, value?: any): this {
    if (typeof column === "function") {
      this.knexBuilder.orWhere(column);
    } else if (typeof column === "object" && column !== null) {
      const converted: Record<string, any> = {};
      for (const [k, v] of Object.entries(column)) {
        converted[toSnakeCase(k)] = v;
      }
      this.knexBuilder.orWhere(converted);
    } else if (typeof column === "string") {
      const col = toSnakeCase(column);
      if (value === undefined) {
        this.knexBuilder.orWhere(col, operator);
      } else {
        this.knexBuilder.orWhere(col, operator, value);
      }
    } else {
      this.knexBuilder.orWhere(column, operator, value);
    }
    return this;
  }

  whereIn(column: string, values: any[]): this {
    this.knexBuilder.whereIn(toSnakeCase(column), values);
    return this;
  }

  whereNotIn(column: string, values: any[]): this {
    this.knexBuilder.whereNotIn(toSnakeCase(column), values);
    return this;
  }

  whereNull(column: string): this {
    this.knexBuilder.whereNull(toSnakeCase(column));
    return this;
  }

  whereNotNull(column: string): this {
    this.knexBuilder.whereNotNull(toSnakeCase(column));
    return this;
  }

  whereBetween(column: string, range: [any, any]): this {
    this.knexBuilder.whereBetween(toSnakeCase(column), range);
    return this;
  }

  whereLike(column: string, pattern: string): this {
    this.knexBuilder.whereLike(toSnakeCase(column), pattern);
    return this;
  }

  whereILike(column: string, pattern: string): this {
    this.knexBuilder.whereILike(toSnakeCase(column), pattern);
    return this;
  }

  select(...columns: any[]): this {
    const converted = columns.map((col) =>
      typeof col === "string" ? toSnakeCase(col) : col,
    );
    this.knexBuilder.select(...converted);
    return this;
  }

  orderBy(column: string, direction: "asc" | "desc" = "asc"): this {
    this.knexBuilder.orderBy(toSnakeCase(column), direction);
    return this;
  }

  latest(column = "created_at"): this {
    return this.orderBy(column, "desc");
  }

  oldest(column = "created_at"): this {
    return this.orderBy(column, "asc");
  }

  limit(count: number): this {
    this.knexBuilder.limit(count);
    return this;
  }

  take(count: number): this {
    return this.limit(count);
  }

  offset(count: number): this {
    this.knexBuilder.offset(count);
    return this;
  }

  skip(count: number): this {
    return this.offset(count);
  }

  join(
    table: string,
    first: string,
    operatorOrSecond: string,
    second?: string,
  ): this {
    if (second === undefined) {
      this.knexBuilder.join(table, first, operatorOrSecond);
    } else {
      this.knexBuilder.join(table, first, operatorOrSecond, second);
    }
    return this;
  }

  leftJoin(
    table: string,
    first: string,
    operatorOrSecond: string,
    second?: string,
  ): this {
    if (second === undefined) {
      this.knexBuilder.leftJoin(table, first, operatorOrSecond);
    } else {
      this.knexBuilder.leftJoin(table, first, operatorOrSecond, second);
    }
    return this;
  }

  /**
   * Eager load relations (e.g. .with('author', 'posts.comments'))
   */
  with(...relations: (string | string[])[]): this {
    const flattened = relations.flat();
    this.eagerRelations.push(...flattened);
    return this;
  }

  /**
   * Helper to retrieve a relation instance from a temporary model instance.
   */
  protected getRelationInstance(relationName: string): any {
    const dummy = new this.modelClass({}, false);
    if (typeof dummy[relationName] !== "function") {
      throw AppError.Internal(
        `[veap:ORM] Relation "${relationName}" is not defined on model ${this.modelClass.name || this.modelClass.table}.`,
      );
    }
    const rel = dummy[relationName]();
    if (!rel) {
      throw AppError.Internal(
        `[veap:ORM] Method "${relationName}" on model ${this.modelClass.name || this.modelClass.table} did not return a valid Relation instance.`,
      );
    }
    return rel;
  }

  /**
   * Builds an EXISTS or COUNT subquery for a relation.
   */
  protected buildRelationSubquery(
    sub: Knex.QueryBuilder,
    relationName: string,
    callback?: (builder: ModelQueryBuilder) => void,
    isCount = false,
  ): void {
    const rel = this.getRelationInstance(relationName);
    const parentTable = this.modelClass.table;
    const relatedTable = rel.related.table;
    const knex = getKnex();

    if (isCount) {
      sub.from(relatedTable).count("* as count");
    } else {
      sub.from(relatedTable).select(knex.raw(1));
    }

    if (rel instanceof MorphToMany) {
      const pivotTable = rel.pivotTable;
      const foreignPivotKey = toSnakeCase(rel.foreignPivotKey);
      const relatedPivotKey = toSnakeCase(rel.relatedPivotKey);
      const relatedKey = toSnakeCase(rel.relatedKey || "id");
      const localKey = toSnakeCase(rel.localKey || "id");
      const typeColumn = toSnakeCase(rel.morphTypeColumn);

      sub.join(
        pivotTable,
        `${relatedTable}.${relatedKey}`,
        `${pivotTable}.${relatedPivotKey}`,
      );
      sub.where(`${pivotTable}.${typeColumn}`, rel.morphType);
      sub.whereRaw("CAST(?? AS TEXT) = CAST(?? AS TEXT)", [
        `${pivotTable}.${foreignPivotKey}`,
        `${parentTable}.${localKey}`,
      ]);
    } else if (rel instanceof MorphedByMany) {
      const pivotTable = rel.pivotTable;
      const foreignPivotKey = toSnakeCase(rel.foreignPivotKey);
      const relatedPivotKey = toSnakeCase(rel.relatedPivotKey);
      const relatedKey = toSnakeCase(rel.relatedKey || "id");
      const localKey = toSnakeCase(rel.localKey || "id");
      const typeColumn = toSnakeCase(rel.morphTypeColumn);

      sub.join(pivotTable, function () {
        this.on(
          knex.raw("CAST(?? AS TEXT) = CAST(?? AS TEXT)", [
            `${relatedTable}.${relatedKey}`,
            `${pivotTable}.${foreignPivotKey}`,
          ]),
        );
      });
      sub.where(`${pivotTable}.${typeColumn}`, rel.morphType);
      sub.whereRaw("?? = ??", [
        `${pivotTable}.${relatedPivotKey}`,
        `${parentTable}.${localKey}`,
      ]);
    } else if (rel instanceof BelongsToMany || rel.pivotTable) {
      const pivotTable = rel.pivotTable;
      const foreignPivotKey = toSnakeCase(rel.foreignPivotKey);
      const relatedPivotKey = toSnakeCase(rel.relatedPivotKey);
      const relatedKey = toSnakeCase(rel.relatedKey || "id");
      const localKey = toSnakeCase(rel.localKey || "id");

      sub.join(
        pivotTable,
        `${relatedTable}.${relatedKey}`,
        `${pivotTable}.${relatedPivotKey}`,
      );
      sub.whereRaw("?? = ??", [
        `${pivotTable}.${foreignPivotKey}`,
        `${parentTable}.${localKey}`,
      ]);
    } else if (rel instanceof BelongsTo) {
      const foreignKey = toSnakeCase(rel.foreignKey);
      const localKey = toSnakeCase(rel.localKey || "id");
      sub.whereRaw("?? = ??", [
        `${relatedTable}.${localKey}`,
        `${parentTable}.${foreignKey}`,
      ]);
    } else if (rel instanceof MorphMany || rel instanceof MorphOne) {
      const foreignKey = toSnakeCase((rel as any).idColumn || rel.foreignKey);
      const localKey = toSnakeCase(rel.localKey || "id");
      const typeColumn = toSnakeCase((rel as any).typeColumn);
      sub.where(`${relatedTable}.${typeColumn}`, (rel as any).morphType);
      sub.whereRaw("CAST(?? AS TEXT) = CAST(?? AS TEXT)", [
        `${relatedTable}.${foreignKey}`,
        `${parentTable}.${localKey}`,
      ]);
    } else {
      // HasOne or HasMany
      const foreignKey = toSnakeCase(rel.foreignKey);
      const localKey = toSnakeCase(rel.localKey || "id");
      sub.whereRaw("?? = ??", [
        `${relatedTable}.${foreignKey}`,
        `${parentTable}.${localKey}`,
      ]);
    }

    if (rel.related.softDeletes) {
      const delCol = toSnakeCase(rel.related.deletedAtColumn || "deleted_at");
      sub.whereNull(`${relatedTable}.${delCol}`);
    }

    if (callback) {
      const relatedQuery = new ModelQueryBuilder(rel.related, sub);
      callback(relatedQuery);
    }
  }

  /**
   * Adds a relationship count condition to the query with where clause.
   */
  has(
    relation: string,
    operator = ">=",
    count = 1,
    boolean: "and" | "or" = "and",
    callback?: (query: ModelQueryBuilder) => void,
  ): this {
    if (operator === ">=" && count === 1 && !callback) {
      return boolean === "or"
        ? this.orWhereHas(relation)
        : this.whereHas(relation);
    }
    if (
      ((operator === "<" && count === 1) ||
        (operator === "=" && count === 0)) &&
      !callback
    ) {
      return boolean === "or"
        ? this.orWhereDoesntHave(relation)
        : this.whereDoesntHave(relation);
    }

    const knex = getKnex();
    const sub = knex.queryBuilder();
    this.buildRelationSubquery(sub, relation, callback, true);

    const rawClause = `(${sub.toQuery()}) ${operator} ?`;
    if (boolean === "or") {
      this.knexBuilder.orWhereRaw(rawClause, [count]);
    } else {
      this.knexBuilder.whereRaw(rawClause, [count]);
    }

    return this;
  }

  /**
   * Adds an OR relationship count condition to the query.
   */
  orHas(
    relation: string,
    operator = ">=",
    count = 1,
    callback?: (query: ModelQueryBuilder) => void,
  ): this {
    return this.has(relation, operator, count, "or", callback);
  }

  /**
   * Adds a relationship existence condition with an optional callback constraint.
   */
  whereHas(
    relation: string,
    callback?: (query: ModelQueryBuilder) => void,
  ): this {
    this.knexBuilder.whereExists((sub) => {
      this.buildRelationSubquery(sub, relation, callback, false);
    });
    return this;
  }

  /**
   * Adds an OR relationship existence condition with an optional callback constraint.
   */
  orWhereHas(
    relation: string,
    callback?: (query: ModelQueryBuilder) => void,
  ): this {
    this.knexBuilder.orWhereExists((sub) => {
      this.buildRelationSubquery(sub, relation, callback, false);
    });
    return this;
  }

  /**
   * Adds a relationship absence condition with an optional callback constraint.
   */
  whereDoesntHave(
    relation: string,
    callback?: (query: ModelQueryBuilder) => void,
  ): this {
    this.knexBuilder.whereNotExists((sub) => {
      this.buildRelationSubquery(sub, relation, callback, false);
    });
    return this;
  }

  /**
   * Adds an OR relationship absence condition with an optional callback constraint.
   */
  orWhereDoesntHave(
    relation: string,
    callback?: (query: ModelQueryBuilder) => void,
  ): this {
    this.knexBuilder.orWhereNotExists((sub) => {
      this.buildRelationSubquery(sub, relation, callback, false);
    });
    return this;
  }

  /**
   * Alias for whereDoesntHave.
   */
  doesntHave(relation: string): this {
    return this.whereDoesntHave(relation);
  }

  /**
   * Alias for orWhereDoesntHave.
   */
  orDoesntHave(relation: string): this {
    return this.orWhereDoesntHave(relation);
  }

  /**
   * Adds subquery counts for related models as `{relation}_count`.
   */
  withCount(
    ...relations: (
      | string
      | string[]
      | Record<string, ((q: ModelQueryBuilder) => void) | undefined>
    )[]
  ): this {
    const normalized: Record<
      string,
      ((q: ModelQueryBuilder) => void) | undefined
    > = {};

    for (const item of relations) {
      if (typeof item === "string") {
        normalized[item] = undefined;
      } else if (Array.isArray(item)) {
        for (const subItem of item) {
          normalized[subItem] = undefined;
        }
      } else if (typeof item === "object" && item !== null) {
        for (const [key, callback] of Object.entries(item)) {
          normalized[key] = callback as any;
        }
      }
    }

    // Ensure main table columns are selected if no columns have been explicitly selected yet
    const statements = (this.knexBuilder as any)._statements || [];
    const hasColumns = statements.some((s: any) => s.grouping === "columns");
    if (!hasColumns) {
      this.knexBuilder.select(`${this.modelClass.table}.*`);
    }

    const knex = getKnex();
    for (const [relName, callback] of Object.entries(normalized)) {
      const sub = knex.queryBuilder();
      this.buildRelationSubquery(sub, relName, callback, true);
      const colAlias = `${toSnakeCase(relName)}_count`;
      this.knexBuilder.select(knex.raw(`(${sub.toQuery()}) as ??`, [colAlias]));
    }

    return this;
  }

  /**
   * Executes query and returns hydrated Model instances.
   */
  async get(): Promise<M[]> {
    this.applyGlobalScopes();
    const rows = await this.knexBuilder;

    const models = rows.map((row: any) => {
      return new this.modelClass(row, false);
    });

    if (this.eagerRelations.length > 0 && models.length > 0) {
      await eagerLoadRelations(models, this.eagerRelations);
    }

    return models;
  }

  /**
   * Returns the first matched Model instance or null.
   */
  async first(): Promise<M | null> {
    const models = await this.limit(1).get();
    return models[0] || null;
  }

  /**
   * Returns the first matched Model or throws an error.
   */
  async firstOrFail(): Promise<M> {
    const model = await this.first();
    if (!model) {
      throw AppError.Internal(
        `[veap:ORM] Model ${this.modelClass.name} not found matching query.`,
      );
    }
    return model;
  }

  /**
   * Get the first record matching the attributes or instantiate it.
   */
  async firstOrNew(
    attributes: Record<string, any>,
    values: Record<string, any> = {},
  ): Promise<M> {
    const existing = await this.where(attributes).first();
    if (existing) {
      return existing;
    }
    return new this.modelClass({ ...attributes, ...values }, true);
  }

  /**
   * Get the first record matching the attributes or create it.
   */
  async firstOrCreate(
    attributes: Record<string, any>,
    values: Record<string, any> = {},
  ): Promise<M> {
    const existing = await this.where(attributes).first();
    if (existing) {
      return existing;
    }
    const instance = new this.modelClass({ ...attributes, ...values }, true);
    await instance.save();
    return instance;
  }

  /**
   * Create or update a record matching the attributes, and fill it with values.
   */
  async updateOrCreate(
    attributes: Record<string, any>,
    values: Record<string, any> = {},
  ): Promise<M> {
    const existing = await this.where(attributes).first();
    if (existing) {
      existing.fill(values);
      await existing.save();
      return existing;
    }
    const instance = new this.modelClass({ ...attributes, ...values }, true);
    await instance.save();
    return instance;
  }

  /**
   * Finds a record by its primary key.
   */
  async find(id: any): Promise<M | null> {
    const pk = this.modelClass.primaryKey || "id";
    return await this.where(pk, id).first();
  }

  /**
   * Finds a record by primary key or throws an error.
   */
  async findOrFail(id: any): Promise<M> {
    const model = await this.find(id);
    if (!model) {
      throw AppError.Internal(
        `[veap:ORM] Record not found in ${this.modelClass.name} with ID: ${id}`,
      );
    }
    return model;
  }

  /**
   * Counts rows matching criteria.
   */
  async count(column = "*"): Promise<number> {
    this.applyGlobalScopes();
    const col = column === "*" ? "*" : toSnakeCase(column);
    const [result] = await this.knexBuilder.count({ count: col });
    const countVal = (result as any)?.count;
    return Number(countVal || 0);
  }

  /**
   * Checks if any records exist matching criteria.
   */
  async exists(): Promise<boolean> {
    return (await this.count()) > 0;
  }

  /**
   * Plucks a single column's values into an array.
   */
  async pluck<K extends string>(column: K): Promise<any[]> {
    this.applyGlobalScopes();
    const col = toSnakeCase(column);
    const rows = await this.knexBuilder.select(col);
    return rows.map((row: any) =>
      row[col] !== undefined ? row[col] : row[column],
    );
  }

  /**
   * Paginates results.
   */
  async paginate(
    page = 1,
    perPage = 15,
  ): Promise<{
    data: M[];
    total: number;
    page: number;
    perPage: number;
    lastPage: number;
  }> {
    this.applyGlobalScopes();
    const countBuilder = this.knexBuilder.clone().clearSelect().clearOrder();

    const [countResult] = await countBuilder.count({ total: "*" });
    const total = Number((countResult as any)?.total || 0);

    const offset = Math.max(0, (page - 1) * perPage);
    const data = await this.offset(offset).limit(perPage).get();
    const lastPage = Math.max(1, Math.ceil(total / perPage));

    return {
      data,
      total,
      page,
      perPage,
      lastPage,
    };
  }

  /**
   * Bulk updates matching records.
   */
  async update(attributes: Record<string, any>): Promise<number> {
    const converted: Record<string, any> = {};
    const casts = this.modelClass?.casts || {};
    const knex = getKnex();
    const clientType = knex.client?.config?.client;

    for (const [k, v] of Object.entries(attributes)) {
      const col = toSnakeCase(k);
      const castType = casts[k] || casts[col] || casts[toCamelCase(k)];
      converted[col] = serializeForStorage(v, castType, clientType);
    }
    return await this.knexBuilder.update(converted);
  }

  /**
   * Bulk deletes matching records (soft-deletes if softDeletes is enabled).
   */
  async delete(): Promise<number> {
    if (this.modelClass?.softDeletes) {
      this.applyGlobalScopes();
      const col = toSnakeCase(this.modelClass.deletedAtColumn || "deleted_at");
      return await this.update({ [col]: new Date() });
    }
    this.applyGlobalScopes();
    return await this.knexBuilder.delete();
  }

  /**
   * Bulk force-deletes matching records (hard delete regardless of softDeletes setting).
   */
  async forceDelete(): Promise<number> {
    return await this.knexBuilder.delete();
  }

  /**
   * Bulk restores soft-deleted matching records.
   */
  async restore(): Promise<number> {
    if (this.modelClass?.softDeletes) {
      if (this._onlyTrashed) {
        this.applyGlobalScopes();
      }
      const col = toSnakeCase(this.modelClass.deletedAtColumn || "deleted_at");
      return await this.update({ [col]: null });
    }
    return 0;
  }

  /**
   * Increments column value.
   */
  async increment(column: string, amount = 1): Promise<number> {
    return await this.knexBuilder.increment(toSnakeCase(column), amount);
  }

  /**
   * Decrements column value.
   */
  async decrement(column: string, amount = 1): Promise<number> {
    return await this.knexBuilder.decrement(toSnakeCase(column), amount);
  }

  toSQL(): Knex.Sql {
    this.applyGlobalScopes();
    return this.knexBuilder.toSQL();
  }
}
