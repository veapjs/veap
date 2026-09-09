import { AppError } from "../../../domain/errors/app-error";
/** biome-ignore-all lint/correctness/noConstructorReturn: <ignore> */
import { eventBus } from "../../../application/events/event-bus";
import { castAttribute, type CastType, serializeForStorage } from "./casts";
import { getKnex } from "./connection";
import { Factory } from "./factory";
import { ModelQueryBuilder } from "./query-builder";
import {
  BelongsTo,
  BelongsToMany,
  HasMany,
  HasOne,
  MorphMany,
  MorphMap,
  MorphOne,
  MorphTo,
  MorphToMany,
  MorphedByMany,
} from "./relations";
import type { GlobalScope } from "./scopes";
import { toCamelCase, toSnakeCase } from "./utils";

export abstract class Model<
  Attributes extends Record<string, any> = Record<string, any>,
> {
  [key: string]: any;

  /**
   * Database table name.
   */
  static table: string;

  /**
   * Optional polymorphic morph alias (e.g. 'post', 'category', 'user').
   */
  static morphAlias?: string;

  /**
   * Primary key column name.
   */
  static primaryKey = "id";

  /**
   * Whether to automatically generate UUID v4 for the primary key on creation.
   */
  static autoUuid = true;

  /**
   * Whether the table has timestamp columns.
   * Can be true (both created_at and updated_at), false (none),
   * or an array of specific timestamp columns like ["created_at"].
   */
  static timestamps: boolean | string[] = true;

  /**
   * Attribute type casts dictionary.
   */
  static casts: Record<string, CastType> = {};

  /**
   * Whether this model uses soft deletes.
   */
  static softDeletes = false;

  /**
   * Column name used for soft deletes.
   */
  static deletedAtColumn = "deleted_at";

  /**
   * Hidden attributes that should not be included in toJSON serialization.
   */
  static hidden: string[] = [];

  /**
   * Attributes that are mass assignable.
   * If not empty, only attributes in this array can be mass-assigned.
   */
  static fillable: string[] = [];

  /**
   * Attributes that are guarded from mass assignment.
   * If '*' or non-empty, attributes in this array cannot be mass-assigned.
   */
  static guarded: string[] = [];

  /**
   * Registered global scopes dictionary.
   */
  static globalScopes: Record<string, GlobalScope> = {};

  /**
   * Registers a new global scope on this model.
   */
  static addGlobalScope(name: string, scope: GlobalScope): void {
    if (!this.globalScopes) {
      this.globalScopes = {};
    }
    // Ensure subclass has its own dictionary (not mutating parent Model.globalScopes)
    if (!Object.prototype.hasOwnProperty.call(this, "globalScopes")) {
      this.globalScopes = { ...this.globalScopes };
    }
    this.globalScopes[name] = scope;
  }

  /**
   * Checks if a global scope is registered on this model.
   */
  static hasGlobalScope(name: string): boolean {
    return !!this.globalScopes?.[name];
  }

  /**
   * Model attributes stored in state.
   */
  protected _attributes: Record<string, any> = {};

  /**
   * Original attributes as loaded from database (for dirty tracking).
   */
  protected _original: Record<string, any> = {};

  /**
   * Eager-loaded relations.
   */
  protected _relations: Record<string, any> = {};

  /**
   * Indicates if the model exists in the database.
   */
  public isNew = true;

  constructor(attributes: Partial<Attributes> = {}, isNew = true) {
    this.isNew = isNew;

    if (attributes) {
      if (isNew) {
        this.fill(attributes);
      } else {
        this.hydrate(attributes);
      }
    }

    // Return a Proxy to allow direct property access (model.email, model.title)
    return new Proxy(this, {
      get(target, prop, receiver) {
        if (typeof prop === "string") {
          // 1. Internal/private properties or fundamental Object/Model methods
          if (
            prop.startsWith("_") ||
            prop === "isNew" ||
            prop === "constructor" ||
            prop === "toJSON" ||
            prop === "toString" ||
            prop === "valueOf"
          ) {
            return Reflect.get(target, prop, receiver);
          }

          // 2. Base Model instance methods (save, delete, update, getAttribute, etc.)
          const baseDesc = Object.getOwnPropertyDescriptor(
            Model.prototype,
            prop,
          );
          if (baseDesc && typeof baseDesc.value === "function") {
            return Reflect.get(target, prop, receiver);
          }

          // 3. Loaded relations take precedence over relation-defining methods!
          if (prop in target._relations) {
            return target._relations[prop];
          }

          // 4. Attribute value from model attributes
          const attr = target.getAttribute(prop);
          if (attr !== undefined) {
            return attr;
          }

          // 5. Prototype method/getter on model class or base classes
          let currProto = Object.getPrototypeOf(target);
          while (currProto && currProto !== Object.prototype) {
            const protoDesc = Object.getOwnPropertyDescriptor(currProto, prop);
            if (protoDesc) {
              if (typeof protoDesc.value === "function" || protoDesc.get) {
                return Reflect.get(target, prop, receiver);
              }
            }
            currProto = Object.getPrototypeOf(currProto);
          }

          return undefined;
        }
        return Reflect.get(target, prop, receiver);
      },
      set(target, prop, value, receiver) {
        if (typeof prop === "string") {
          if (prop.startsWith("_") || prop === "isNew") {
            return Reflect.set(target, prop, value, receiver);
          }
          let currProto = Object.getPrototypeOf(target);
          while (currProto && currProto !== Object.prototype) {
            const protoDesc = Object.getOwnPropertyDescriptor(currProto, prop);
            if (protoDesc?.set) {
              return Reflect.set(target, prop, value, receiver);
            }
            currProto = Object.getPrototypeOf(currProto);
          }
          target.setAttribute(prop, value);
          return true;
        }
        return Reflect.set(target, prop, value, receiver);
      },
    });
  }

  get id(): any {
    return this.getAttribute((this.constructor as typeof Model).primaryKey);
  }

  set id(value: any) {
    this.setAttribute((this.constructor as typeof Model).primaryKey, value);
  }

  /**
   * Static Query Builder entrypoint.
   */
  static query<M extends Model>(this: {
    new (...args: any[]): M;
    table: string;
  }): ModelQueryBuilder<M> {
    return new ModelQueryBuilder<M>(this);
  }

  /**
   * Starts a query builder including soft-deleted models.
   */
  static withTrashed<M extends Model>(this: {
    new (...args: any[]): M;
    table: string;
  }): ModelQueryBuilder<M> {
    return (this as any).query().withTrashed();
  }

  /**
   * Starts a query builder restricting to only soft-deleted models.
   */
  static onlyTrashed<M extends Model>(this: {
    new (...args: any[]): M;
    table: string;
  }): ModelQueryBuilder<M> {
    return (this as any).query().onlyTrashed();
  }

  /**
   * Finds a model by primary key.
   */
  static async find<M extends Model>(
    this: { new (...args: any[]): M; table: string },
    id: any,
  ): Promise<M | null> {
    return await (this as any).query().find(id);
  }

  /**
   * Finds a model by primary key or throws.
   */
  static async findOrFail<M extends Model>(
    this: { new (...args: any[]): M; table: string },
    id: any,
  ): Promise<M> {
    return await (this as any).query().findOrFail(id);
  }

  /**
   * Gets all records from table.
   */
  static async all<M extends Model>(this: {
    new (...args: any[]): M;
    table: string;
  }): Promise<M[]> {
    return await (this as any).query().get();
  }

  /**
   * Counts rows in table.
   */
  static async count<M extends Model>(
    this: { new (...args: any[]): M; table: string },
    column = "*",
  ): Promise<number> {
    return await (this as any).query().count(column);
  }

  /**
   * Starts a WHERE query.
   */
  static where<M extends Model>(
    this: { new (...args: any[]): M; table: string },
    column: string | Record<string, any>,
    operator?: any,
    value?: any,
  ): ModelQueryBuilder<M> {
    return (this as any).query().where(column, operator, value);
  }

  /**
   * Creates and saves a new model instance.
   */
  static async create<M extends Model>(
    this: { new (...args: any[]): M; table: string },
    attributes: Record<string, any>,
  ): Promise<M> {
    const instance = new (this as any)(attributes, true);
    await instance.save();
    return instance;
  }

  /**
   * Creates and saves a new model instance without mass assignment restrictions.
   */
  static async forceCreate<M extends Model>(
    this: { new (...args: any[]): M; table: string },
    attributes: Record<string, any>,
  ): Promise<M> {
    const instance = new (this as any)({}, true);
    instance.forceFill(attributes);
    await instance.save();
    return instance;
  }

  /**
   * Finds the first record matching attributes or creates and saves a new instance.
   */
  static async firstOrCreate<M extends Model>(
    this: { new (...args: any[]): M; table: string },
    attributes: Record<string, any>,
    values: Record<string, any> = {},
  ): Promise<M> {
    return await (this as any).query().firstOrCreate(attributes, values);
  }

  /**
   * Finds the first record matching attributes or instantiates a new instance (unsaved).
   */
  static async firstOrNew<M extends Model>(
    this: { new (...args: any[]): M; table: string },
    attributes: Record<string, any>,
    values: Record<string, any> = {},
  ): Promise<M> {
    return await (this as any).query().firstOrNew(attributes, values);
  }

  /**
   * Creates or updates a record matching attributes, filling it with values.
   */
  static async updateOrCreate<M extends Model>(
    this: { new (...args: any[]): M; table: string },
    attributes: Record<string, any>,
    values: Record<string, any> = {},
  ): Promise<M> {
    return await (this as any).query().updateOrCreate(attributes, values);
  }

  /**
   * Begins querying a relation existence on the model.
   */
  static has<M extends Model>(
    this: { new (...args: any[]): M; table: string },
    relation: string,
    operator = ">=",
    count = 1,
  ): ModelQueryBuilder<M> {
    return (this as any).query().has(relation, operator, count);
  }

  /**
   * Begins querying a relation with a callback on the model.
   */
  static whereHas<M extends Model>(
    this: { new (...args: any[]): M; table: string },
    relation: string,
    callback?: (query: ModelQueryBuilder) => void,
  ): ModelQueryBuilder<M> {
    return (this as any).query().whereHas(relation, callback);
  }

  /**
   * Begins querying a relation absence on the model.
   */
  static whereDoesntHave<M extends Model>(
    this: { new (...args: any[]): M; table: string },
    relation: string,
    callback?: (query: ModelQueryBuilder) => void,
  ): ModelQueryBuilder<M> {
    return (this as any).query().whereDoesntHave(relation, callback);
  }

  /**
   * Begins querying with related models count.
   */
  static withCount<M extends Model>(
    this: { new (...args: any[]): M; table: string },
    ...relations: any[]
  ): ModelQueryBuilder<M> {
    return (this as any).query().withCount(...relations);
  }

  /**
   * Executes a database transaction.
   */
  static async transaction<T>(callback: (trx: any) => Promise<T>): Promise<T> {
    const { transaction: runTrx } = await import("./connection");
    return await runTrx(callback);
  }

  /**
   * Applies a local scope by name on a new query builder.
   */
  static scope<M extends Model>(
    this: { new (...args: any[]): M; table: string },
    name: string,
    ...args: any[]
  ): ModelQueryBuilder<M> {
    return (this as any).query().scope(name, ...args);
  }

  /**
   * Excludes a specific global scope on a new query builder.
   */
  static withoutGlobalScope<M extends Model>(
    this: { new (...args: any[]): M; table: string },
    scope: string,
  ): ModelQueryBuilder<M> {
    return (this as any).query().withoutGlobalScope(scope);
  }

  /**
   * Excludes multiple or all global scopes on a new query builder.
   */
  static withoutGlobalScopes<M extends Model>(
    this: { new (...args: any[]): M; table: string },
    scopes?: string[],
  ): ModelQueryBuilder<M> {
    return (this as any).query().withoutGlobalScopes(scopes);
  }

  /**
   * Starts a new Factory for this model.
   * Uses static newFactory() method on the model class.
   */
  static factory<F = any>(this: any, count?: number): F {
    const registered = Factory.getForModel(this);
    if (registered) {
      const f =
        typeof registered === "function" &&
        !(registered.prototype instanceof Factory)
          ? registered(count)
          : new registered();
      if (count !== undefined && typeof f.count === "function") {
        f.count(count);
      }
      return f as F;
    }

    if (typeof this.newFactory === "function") {
      const f = this.newFactory();
      if (count !== undefined && typeof f.count === "function") {
        f.count(count);
      }
      return f;
    }
    throw AppError.Internal(
      `[veap:ORM] Model ${this.name || this.table} does not have a factory defined. Implement static newFactory() or use defineFactory().`,
    );
  }

  /**
   * Deletes a model by primary key (soft-deletes if softDeletes is enabled).
   */
  static async destroy(this: typeof Model, id: any): Promise<boolean> {
    const knex = getKnex();
    if ((this as any).softDeletes) {
      const col = toSnakeCase((this as any).deletedAtColumn || "deleted_at");
      const count = await knex(this.table)
        .where(this.primaryKey, id)
        .whereNull(col)
        .update({ [col]: new Date() });
      return count > 0;
    }
    const count = await knex(this.table).where(this.primaryKey, id).delete();
    return count > 0;
  }

  /**
   * Permanently deletes a model by primary key regardless of softDeletes setting.
   */
  static async forceDestroy(this: typeof Model, id: any): Promise<boolean> {
    const knex = getKnex();
    const count = await knex(this.table).where(this.primaryKey, id).delete();
    return count > 0;
  }

  /**
   * Restores a soft-deleted model by primary key.
   */
  static async restore(this: typeof Model, id: any): Promise<boolean> {
    const knex = getKnex();
    const col = toSnakeCase((this as any).deletedAtColumn || "deleted_at");
    const count = await knex(this.table)
      .where(this.primaryKey, id)
      .update({ [col]: null });
    return count > 0;
  }

  /**
   * Determines if the given attribute may be mass assigned.
   */
  isFillable(key: string): boolean {
    const modelClass = this.constructor as typeof Model;
    const fillable = modelClass.fillable || [];
    const guarded = modelClass.guarded || [];

    const snake = toSnakeCase(key);
    const camel = toCamelCase(key);

    const isInList = (list: string[]) =>
      list.includes(key) || list.includes(snake) || list.includes(camel);

    // If guarded includes '*', nothing is fillable
    if (guarded.includes("*")) {
      return false;
    }

    // If fillable is non-empty, only listed attributes are fillable
    if (fillable.length > 0) {
      return isInList(fillable);
    }

    // If guarded is non-empty, anything not in guarded is fillable
    if (guarded.length > 0) {
      return !isInList(guarded);
    }

    // Default: allow all if neither fillable nor guarded are set
    return true;
  }

  /**
   * Fills model with mass-assignable attributes.
   */
  fill(attributes: Partial<Attributes>): this {
    for (const [key, value] of Object.entries(attributes)) {
      if (this.isFillable(key)) {
        this.setAttribute(key, value);
      }
    }
    return this;
  }

  /**
   * Force fills model with attributes, bypassing fillable/guarded protection.
   */
  forceFill(attributes: Partial<Attributes>): this {
    for (const [key, value] of Object.entries(attributes)) {
      this.setAttribute(key, value);
    }
    return this;
  }

  /**
   * Fires a model lifecycle event.
   * Calls instance hook methods (e.g. beforeSave/saving) and publishes to eventBus.
   * If any handler returns false, the operation is canceled.
   */
  protected async fireModelEvent(event: string): Promise<boolean> {
    const modelClass = this.constructor as typeof Model;
    const tableName = modelClass.table || "unknown";

    // 1. Check instance hook methods
    const methodMap: Record<string, string[]> = {
      saving: ["saving", "beforeSave"],
      saved: ["saved", "afterSave"],
      creating: ["creating", "beforeCreate"],
      created: ["created", "afterCreate"],
      updating: ["updating", "beforeUpdate"],
      updated: ["updated", "afterUpdate"],
      deleting: ["deleting", "beforeDelete"],
      deleted: ["deleted", "afterDelete"],
      restoring: ["restoring", "beforeRestore"],
      restored: ["restored", "afterRestore"],
    };

    const candidateMethods = methodMap[event] || [event];
    for (const methodName of candidateMethods) {
      if (typeof (this as any)[methodName] === "function") {
        const result = await (this as any)[methodName]();
        if (result === false) {
          return false;
        }
      }
    }

    // 2. Publish to Veap EventBus
    try {
      await eventBus.publish(
        `model:${event}:${tableName}` as any,
        { model: this, event, table: tableName } as any,
        "orm",
      );
      await eventBus.publish(
        `model:${event}` as any,
        { model: this, event, table: tableName } as any,
        "orm",
      );
    } catch (_e) {
      // Gracefully handle if eventBus encounters an issue
    }

    return true;
  }

  /**
   * Hydrates attributes from raw database row, applying casts.
   */
  hydrate(rawRow: Record<string, any>): this {
    const modelClass = this.constructor as typeof Model;
    const casts = modelClass.casts || {};
    const isSoftDelete = modelClass.softDeletes;
    const deletedAtCol = modelClass.deletedAtColumn || "deleted_at";

    for (const [key, rawVal] of Object.entries(rawRow)) {
      let castType =
        casts[key] || casts[toCamelCase(key)] || casts[toSnakeCase(key)];
      if (!castType && key.endsWith("_count")) {
        castType = "number";
      }
      if (
        !castType &&
        isSoftDelete &&
        (key === deletedAtCol ||
          key === toCamelCase(deletedAtCol) ||
          key === toSnakeCase(deletedAtCol))
      ) {
        castType = "datetime";
      }
      const val = castType ? castAttribute(rawVal, castType) : rawVal;
      this._attributes[key] = val;
      this._original[key] = val;
    }

    return this;
  }

  getAttribute(key: string): any {
    if (key in this._attributes) {
      return this._attributes[key];
    }
    const snake = toSnakeCase(key);
    if (snake in this._attributes) {
      return this._attributes[snake];
    }
    const camel = toCamelCase(key);
    if (camel in this._attributes) {
      return this._attributes[camel];
    }
    return undefined;
  }

  setAttribute(key: string, value: any): this {
    const modelClass = this.constructor as typeof Model;
    const casts = modelClass.casts || {};
    const isSoftDelete = modelClass.softDeletes;
    const deletedAtCol = modelClass.deletedAtColumn || "deleted_at";

    let castType =
      casts[key] || casts[toSnakeCase(key)] || casts[toCamelCase(key)];
    if (
      !castType &&
      isSoftDelete &&
      (key === deletedAtCol ||
        key === toSnakeCase(deletedAtCol) ||
        key === toCamelCase(deletedAtCol))
    ) {
      castType = "datetime";
    }
    const val = castType ? castAttribute(value, castType) : value;
    this._attributes[key] = val;
    return this;
  }

  isDirty(key?: string): boolean {
    if (key) {
      const current = this.getAttribute(key);
      const original =
        key in this._original
          ? this._original[key]
          : (this._original[toSnakeCase(key)] ??
            this._original[toCamelCase(key)]);
      return current !== original;
    }
    return Object.keys(this._attributes).some(
      (k) => this._attributes[k] !== this._original[k],
    );
  }

  getRelation<R = any>(name: string): R | undefined {
    return this._relations[name];
  }

  setRelation(name: string, value: any): this {
    this._relations[name] = value;
    return this;
  }

  /**
   * Invokes and returns the Relation instance for a given relation name,
   * bypassing any cached/loaded relation data in `_relations`.
   */
  getRelationDefinition(name: string): any {
    let currProto = Object.getPrototypeOf(this);
    while (currProto && currProto !== Object.prototype) {
      const protoDesc = Object.getOwnPropertyDescriptor(currProto, name);
      if (protoDesc && typeof protoDesc.value === "function") {
        return protoDesc.value.call(this);
      }
      currProto = Object.getPrototypeOf(currProto);
    }
    return null;
  }

  /**
   * Saves model to database (INSERT if isNew, UPDATE if exists).
   */
  async save(): Promise<this> {
    if ((await this.fireModelEvent("saving")) === false) {
      return this;
    }

    const modelClass = this.constructor as typeof Model;
    const knex = getKnex();
    const pk = modelClass.primaryKey;
    const casts = modelClass.casts || {};
    const clientType = knex.client.config.client;

    const now = new Date();

    if (this.isNew) {
      if ((await this.fireModelEvent("creating")) === false) {
        return this;
      }

      // Auto-assign UUID if enabled and not already provided
      if (modelClass.autoUuid && !this.getAttribute(pk)) {
        this.setAttribute(pk, crypto.randomUUID());
      }

      // Handle timestamps
      if (modelClass.timestamps) {
        const hasCreatedAt =
          modelClass.timestamps === true ||
          (Array.isArray(modelClass.timestamps) &&
            (modelClass.timestamps.includes("created_at") ||
              modelClass.timestamps.includes("createdAt")));

        const hasUpdatedAt =
          modelClass.timestamps === true ||
          (Array.isArray(modelClass.timestamps) &&
            (modelClass.timestamps.includes("updated_at") ||
              modelClass.timestamps.includes("updatedAt")));

        if (
          hasCreatedAt &&
          !this.getAttribute("created_at") &&
          !this.getAttribute("createdAt")
        ) {
          this.setAttribute("created_at", now);
        }
        if (
          hasUpdatedAt &&
          !this.getAttribute("updated_at") &&
          !this.getAttribute("updatedAt")
        ) {
          this.setAttribute("updated_at", now);
        }
      }

      // Serialize attributes for storage
      const insertData: Record<string, any> = {};
      for (const [k, v] of Object.entries(this._attributes)) {
        const col = toSnakeCase(k);
        let castType = casts[k] || casts[col] || casts[toCamelCase(k)];
        if (
          !castType &&
          modelClass.softDeletes &&
          (k === modelClass.deletedAtColumn ||
            col === toSnakeCase(modelClass.deletedAtColumn || "deleted_at"))
        ) {
          castType = "datetime";
        }
        insertData[col] = serializeForStorage(v, castType, clientType);
      }

      await knex(modelClass.table).insert(insertData);

      this.isNew = false;
      this._original = { ...this._attributes };

      await this.fireModelEvent("created");
      await this.fireModelEvent("saved");
    } else {
      // Only update if dirty
      if (!this.isDirty()) {
        await this.fireModelEvent("saved");
        return this;
      }

      if ((await this.fireModelEvent("updating")) === false) {
        return this;
      }

      if (modelClass.timestamps) {
        const hasUpdatedAt =
          modelClass.timestamps === true ||
          (Array.isArray(modelClass.timestamps) &&
            (modelClass.timestamps.includes("updated_at") ||
              modelClass.timestamps.includes("updatedAt")));

        if (hasUpdatedAt) {
          if (
            "updated_at" in this._attributes ||
            !("updatedAt" in this._attributes)
          ) {
            this.setAttribute("updated_at", now);
          } else {
            this.setAttribute("updatedAt", now);
          }
        }
      }

      const updateData: Record<string, any> = {};
      for (const [k, v] of Object.entries(this._attributes)) {
        if (this._attributes[k] !== this._original[k]) {
          const col = toSnakeCase(k);
          let castType = casts[k] || casts[col] || casts[toCamelCase(k)];
          if (
            !castType &&
            modelClass.softDeletes &&
            (k === modelClass.deletedAtColumn ||
              col === toSnakeCase(modelClass.deletedAtColumn || "deleted_at"))
          ) {
            castType = "datetime";
          }
          updateData[col] = serializeForStorage(v, castType, clientType);
        }
      }

      if (Object.keys(updateData).length > 0) {
        await knex(modelClass.table).where(pk, this.id).update(updateData);
      }

      this._original = { ...this._attributes };

      await this.fireModelEvent("updated");
      await this.fireModelEvent("saved");
    }

    return this;
  }

  /**
   * Updates attributes and saves immediately.
   */
  async update(attributes: Partial<Attributes>): Promise<this> {
    this.fill(attributes);
    return await this.save();
  }

  /**
   * Deletes model from database (soft-deletes if softDeletes is enabled).
   */
  async delete(): Promise<boolean> {
    if (this.isNew) return false;

    if ((await this.fireModelEvent("deleting")) === false) {
      return false;
    }

    const modelClass = this.constructor as typeof Model;
    const knex = getKnex();
    const pk = modelClass.primaryKey;
    const clientType = knex.client.config.client;

    if (modelClass.softDeletes) {
      const colName = modelClass.deletedAtColumn || "deleted_at";
      const col = toSnakeCase(colName);
      const now = new Date();
      await knex(modelClass.table)
        .where(pk, this.id)
        .update({
          [col]: serializeForStorage(now, "datetime", clientType),
        });
      this.setAttribute(colName, now);
      this._original = { ...this._attributes };
      await this.fireModelEvent("deleted");
      return true;
    }

    const count = await knex(modelClass.table).where(pk, this.id).delete();
    if (count > 0) {
      await this.fireModelEvent("deleted");
      return true;
    }

    return false;
  }

  /**
   * Permanently deletes model from database, bypassing soft delete.
   */
  async forceDelete(): Promise<boolean> {
    if (this.isNew) return false;

    if ((await this.fireModelEvent("deleting")) === false) {
      return false;
    }

    const modelClass = this.constructor as typeof Model;
    const knex = getKnex();
    const pk = modelClass.primaryKey;

    const count = await knex(modelClass.table).where(pk, this.id).delete();
    if (count > 0) {
      await this.fireModelEvent("deleted");
      return true;
    }

    return false;
  }

  /**
   * Restores a soft-deleted model.
   */
  async restore(): Promise<boolean> {
    if (this.isNew) return false;

    const modelClass = this.constructor as typeof Model;
    if (!modelClass.softDeletes) return false;

    if ((await this.fireModelEvent("restoring")) === false) {
      return false;
    }

    const knex = getKnex();
    const pk = modelClass.primaryKey;
    const colName = modelClass.deletedAtColumn || "deleted_at";
    const col = toSnakeCase(colName);

    await knex(modelClass.table)
      .where(pk, this.id)
      .update({ [col]: null });

    this.setAttribute(colName, null);
    this._original = { ...this._attributes };
    await this.fireModelEvent("restored");
    return true;
  }

  /**
   * Checks if the model has been soft-deleted.
   */
  trashed(): boolean {
    const modelClass = this.constructor as typeof Model;
    if (!modelClass.softDeletes) return false;
    const col = modelClass.deletedAtColumn || "deleted_at";
    const val = this.getAttribute(col);
    return val !== null && val !== undefined;
  }

  /**
   * Alias for trashed().
   */
  isTrashed(): boolean {
    return this.trashed();
  }

  /**
   * Refreshes model attributes from database.
   */
  async refresh(): Promise<this> {
    if (this.isNew) return this;

    const modelClass = this.constructor as typeof Model;
    const pk = modelClass.primaryKey;
    const fresh = await (modelClass as any).query().find(this.id);

    if (fresh) {
      this._attributes = { ...fresh._attributes };
      this._original = { ...fresh._original };
    }

    return this;
  }

  /**
   * Converts model to JSON object including loaded relations.
   * Provides both original and camelCase aliases for seamless frontend DX.
   */
  toJSON(): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [k, v] of Object.entries(this._attributes)) {
      result[k] = v;
      const camel = toCamelCase(k);
      if (camel !== k) {
        result[camel] = v;
      }
    }

    for (const [relName, relValue] of Object.entries(this._relations)) {
      if (Array.isArray(relValue)) {
        result[relName] = relValue.map((item) =>
          typeof item?.toJSON === "function" ? item.toJSON() : item,
        );
      } else if (relValue && typeof relValue.toJSON === "function") {
        result[relName] = relValue.toJSON();
      } else {
        result[relName] = relValue;
      }
    }

    const hidden = (this.constructor as typeof Model).hidden || [];
    for (const h of hidden) {
      delete result[h];
      delete result[toCamelCase(h)];
      delete result[toSnakeCase(h)];
    }

    return result;
  }

  // --- RELATION BUILDERS ---

  hasOne<R extends Model>(
    related: { new (...args: any[]): R; table: string },
    foreignKey?: string,
    localKey = (this.constructor as typeof Model).primaryKey,
  ): HasOne<this, R> {
    const fk = foreignKey
      ? toSnakeCase(foreignKey)
      : `${toSnakeCase((this.constructor as typeof Model).table)}_id`;
    return new HasOne(this, related, fk, localKey);
  }

  hasMany<R extends Model>(
    related: { new (...args: any[]): R; table: string },
    foreignKey?: string,
    localKey = (this.constructor as typeof Model).primaryKey,
  ): HasMany<this, R> {
    const fk = foreignKey
      ? toSnakeCase(foreignKey)
      : `${toSnakeCase((this.constructor as typeof Model).table)}_id`;
    return new HasMany(this, related, fk, localKey);
  }

  belongsTo<R extends Model>(
    related: {
      new (...args: any[]): R;
      table: string;
      primaryKey?: string;
      name?: string;
    },
    foreignKey?: string,
    ownerKey = related.primaryKey || "id",
  ): BelongsTo<this, R> {
    const fallbackFk = `${toSnakeCase(related.name || related.table)}_id`;
    const fk = foreignKey ? toSnakeCase(foreignKey) : fallbackFk;
    return new BelongsTo(this, related, fk, ownerKey);
  }

  belongsToMany<R extends Model>(
    related: {
      new (...args: any[]): R;
      table: string;
      primaryKey?: string;
      name?: string;
    },
    pivotTable: string,
    foreignPivotKey?: string,
    relatedPivotKey?: string,
    localKey = (this.constructor as typeof Model).primaryKey,
    relatedKey = related.primaryKey || "id",
  ): BelongsToMany<this, R> {
    const fpk = foreignPivotKey
      ? toSnakeCase(foreignPivotKey)
      : `${toSnakeCase((this.constructor as typeof Model).table)}_id`;
    const rpk = relatedPivotKey
      ? toSnakeCase(relatedPivotKey)
      : `${toSnakeCase(related.name || related.table)}_id`;
    return new BelongsToMany(
      this,
      related,
      pivotTable,
      fpk,
      rpk,
      localKey,
      relatedKey,
    );
  }

  // --- POLYMORPHIC RELATION BUILDERS ---

  /**
   * Defines a polymorphic, inverse one-to-one or one-to-many relation.
   * E.g. comment.morphTo('commentable') -> resolves type from commentable_type and id from commentable_id
   */
  morphTo<R extends Model = any>(
    name?: string,
    type?: string,
    id?: string,
  ): MorphTo<this, R> {
    const callerName = name || "commentable";
    const typeCol = type
      ? toSnakeCase(type)
      : `${toSnakeCase(callerName)}_type`;
    const idCol = id ? toSnakeCase(id) : `${toSnakeCase(callerName)}_id`;
    return new MorphTo(this, callerName, typeCol, idCol);
  }

  /**
   * Defines a polymorphic one-to-one relation.
   * E.g. user.morphOne(Image, 'imageable')
   */
  morphOne<R extends Model>(
    related: { new (...args: any[]): R; table: string; primaryKey?: string },
    name: string,
    type?: string,
    id?: string,
    localKey = (this.constructor as typeof Model).primaryKey || "id",
  ): MorphOne<this, R> {
    const typeCol = type ? toSnakeCase(type) : `${toSnakeCase(name)}_type`;
    const idCol = id ? toSnakeCase(id) : `${toSnakeCase(name)}_id`;
    return new MorphOne(this, related, name, typeCol, idCol, localKey);
  }

  /**
   * Defines a polymorphic one-to-many relation.
   * E.g. post.morphMany(Comment, 'commentable')
   */
  morphMany<R extends Model>(
    related: { new (...args: any[]): R; table: string; primaryKey?: string },
    name: string,
    type?: string,
    id?: string,
    localKey = (this.constructor as typeof Model).primaryKey || "id",
  ): MorphMany<this, R> {
    const typeCol = type ? toSnakeCase(type) : `${toSnakeCase(name)}_type`;
    const idCol = id ? toSnakeCase(id) : `${toSnakeCase(name)}_id`;
    return new MorphMany(this, related, name, typeCol, idCol, localKey);
  }

  /**
   * Defines a polymorphic many-to-many relation where the parent is the polymorphic entity.
   * E.g. post.morphToMany(Tag, 'taggable', 'taggables')
   */
  morphToMany<R extends Model>(
    related: {
      new (...args: any[]): R;
      table: string;
      primaryKey?: string;
      name?: string;
    },
    name: string,
    pivotTable = `${toSnakeCase(name)}s`,
    foreignPivotKey?: string,
    relatedPivotKey?: string,
    parentKey = (this.constructor as typeof Model).primaryKey || "id",
    relatedKey = related.primaryKey || "id",
  ): MorphToMany<this, R> {
    const fpk = foreignPivotKey
      ? toSnakeCase(foreignPivotKey)
      : `${toSnakeCase(name)}_id`;
    const relatedAlias = MorphMap.getMorphAlias(related);
    const rpk = relatedPivotKey
      ? toSnakeCase(relatedPivotKey)
      : `${toSnakeCase(relatedAlias)}_id`;
    const morphTypeColumn = `${toSnakeCase(name)}_type`;
    return new MorphToMany(
      this,
      related,
      name,
      pivotTable,
      fpk,
      rpk,
      morphTypeColumn,
      parentKey,
      relatedKey,
    );
  }

  /**
   * Defines the inverse of a polymorphic many-to-many relation.
   * E.g. tag.morphedByMany(BlogPost, 'taggable', 'taggables')
   */
  morphedByMany<R extends Model>(
    related: {
      new (...args: any[]): R;
      table: string;
      primaryKey?: string;
      name?: string;
    },
    name: string,
    pivotTable = `${toSnakeCase(name)}s`,
    foreignPivotKey?: string,
    relatedPivotKey?: string,
    parentKey = (this.constructor as typeof Model).primaryKey || "id",
    relatedKey = related.primaryKey || "id",
  ): MorphedByMany<this, R> {
    const fpk = foreignPivotKey
      ? toSnakeCase(foreignPivotKey)
      : `${toSnakeCase(name)}_id`;
    const parentAlias = MorphMap.getMorphAlias(this.constructor);
    const rpk = relatedPivotKey
      ? toSnakeCase(relatedPivotKey)
      : `${toSnakeCase(parentAlias)}_id`;
    const morphTypeColumn = `${toSnakeCase(name)}_type`;
    return new MorphedByMany(
      this,
      related,
      name,
      pivotTable,
      fpk,
      rpk,
      morphTypeColumn,
      parentKey,
      relatedKey,
    );
  }
}
