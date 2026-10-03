import { getKnex } from "../connection";
import type { Model } from "../model";
import type { ModelQueryBuilder } from "../query-builder";
import { MorphMap } from "./morph-map";
import { Relation } from "./relation";

/**
 * MorphToMany represents a many-to-many polymorphic relation where the parent
 * owns the polymorphic side of the pivot table (e.g. BlogPost -> tags via taggables).
 * Pivot columns: ${morphName}_id, ${morphName}_type, ${relatedPivotKey}
 */
export class MorphToMany<
  Parent extends Model = any,
  Related extends Model = any,
> extends Relation<Parent, Related> {
  public morphType: string;

  constructor(
    parent: Parent,
    related: any,
    public morphName: string,
    public pivotTable: string,
    public foreignPivotKey: string,
    public relatedPivotKey: string,
    public morphTypeColumn: string,
    localKey = (parent.constructor as typeof Model).primaryKey || "id",
    public relatedKey = (related as typeof Model).primaryKey || "id",
  ) {
    super(parent, related, foreignPivotKey, localKey);
    this.morphType = MorphMap.getMorphAlias(parent);
  }

  query(): ModelQueryBuilder<Related> {
    const localKeyValue = this.parent.getAttribute(this.localKey);
    const relatedTable = this.related.table;

    return this.related
      .query()
      .join(
        this.pivotTable,
        `${relatedTable}.${this.relatedKey}`,
        `${this.pivotTable}.${this.relatedPivotKey}`,
      )
      .where(`${this.pivotTable}.${this.foreignPivotKey}`, localKeyValue)
      .where(`${this.pivotTable}.${this.morphTypeColumn}`, this.morphType);
  }

  async get(): Promise<Related[]> {
    const localKeyValue = this.parent.getAttribute(this.localKey);
    if (localKeyValue === null || localKeyValue === undefined) {
      return [];
    }
    return await this.query().get();
  }

  async attach(relatedId: any, extraAttributes: Record<string, any> = {}) {
    const knex = getKnex();
    const localKeyValue = this.parent.getAttribute(this.localKey);

    const ids = Array.isArray(relatedId) ? relatedId : [relatedId];
    const rows = ids.map((id) => ({
      [this.foreignPivotKey]: localKeyValue,
      [this.morphTypeColumn]: this.morphType,
      [this.relatedPivotKey]: id,
      ...extraAttributes,
    }));

    await knex(this.pivotTable).insert(rows);
  }

  async detach(relatedId?: any) {
    const knex = getKnex();
    const localKeyValue = this.parent.getAttribute(this.localKey);
    let q = knex(this.pivotTable)
      .where(this.foreignPivotKey, localKeyValue)
      .where(this.morphTypeColumn, this.morphType);

    if (relatedId !== undefined) {
      if (Array.isArray(relatedId)) {
        q = q.whereIn(this.relatedPivotKey, relatedId);
      } else {
        q = q.where(this.relatedPivotKey, relatedId);
      }
    }

    await q.delete();
  }

  async sync(ids: any[]) {
    await this.detach();
    if (ids.length > 0) {
      await this.attach(ids);
    }
  }

  async match(parents: Parent[], relationName: string): Promise<void> {
    const localKeys = Array.from(
      new Set(
        parents
          .map((p) => p.getAttribute(this.localKey))
          .filter((key) => key !== null && key !== undefined),
      ),
    );

    if (localKeys.length === 0) {
      for (const parent of parents) {
        parent.setRelation(relationName, []);
      }
      return;
    }

    const knex = getKnex();
    const relatedTable = this.related.table;

    const rows = await knex(relatedTable)
      .join(
        this.pivotTable,
        `${relatedTable}.${this.relatedKey}`,
        `${this.pivotTable}.${this.relatedPivotKey}`,
      )
      .whereIn(`${this.pivotTable}.${this.foreignPivotKey}`, localKeys)
      .where(`${this.pivotTable}.${this.morphTypeColumn}`, this.morphType)
      .select(
        `${relatedTable}.*`,
        `${this.pivotTable}.${this.foreignPivotKey} as _pivot_foreign_key`,
      );

    const lookup = new Map<any, Related[]>();
    for (const row of rows) {
      const parentFk = row._pivot_foreign_key;
      delete row._pivot_foreign_key;

      const model = new this.related(row, false);
      if (!lookup.has(parentFk)) {
        lookup.set(parentFk, []);
      }
      lookup.get(parentFk)!.push(model);
    }

    for (const parent of parents) {
      const lk = parent.getAttribute(this.localKey);
      parent.setRelation(relationName, lookup.get(lk) || []);
    }
  }
}

/**
 * MorphedByMany represents the inverse of MorphToMany (e.g. Tag -> posts via taggables).
 * Pivot columns: ${relatedPivotKey} (tag_id), ${foreignPivotKey} (taggable_id), ${morphTypeColumn} (taggable_type)
 */
export class MorphedByMany<
  Parent extends Model = any,
  Related extends Model = any,
> extends Relation<Parent, Related> {
  public morphType: string;

  constructor(
    parent: Parent,
    related: any,
    public morphName: string,
    public pivotTable: string,
    public foreignPivotKey: string,
    public relatedPivotKey: string,
    public morphTypeColumn: string,
    localKey = (parent.constructor as typeof Model).primaryKey || "id",
    public relatedKey = (related as typeof Model).primaryKey || "id",
  ) {
    super(parent, related, foreignPivotKey, localKey);
    // In inverse, the morphType is the target related model (e.g. "post")
    this.morphType = MorphMap.getMorphAlias(related);
  }

  query(): ModelQueryBuilder<Related> {
    const localKeyValue = this.parent.getAttribute(this.localKey);
    const relatedTable = this.related.table;

    return this.related
      .query()
      .join(
        this.pivotTable,
        `${relatedTable}.${this.relatedKey}`,
        `${this.pivotTable}.${this.foreignPivotKey}`,
      )
      .where(`${this.pivotTable}.${this.relatedPivotKey}`, localKeyValue)
      .where(`${this.pivotTable}.${this.morphTypeColumn}`, this.morphType);
  }

  async get(): Promise<Related[]> {
    const localKeyValue = this.parent.getAttribute(this.localKey);
    if (localKeyValue === null || localKeyValue === undefined) {
      return [];
    }
    return await this.query().get();
  }

  async attach(relatedId: any, extraAttributes: Record<string, any> = {}) {
    const knex = getKnex();
    const localKeyValue = this.parent.getAttribute(this.localKey);

    const ids = Array.isArray(relatedId) ? relatedId : [relatedId];
    const rows = ids.map((id) => ({
      [this.relatedPivotKey]: localKeyValue,
      [this.morphTypeColumn]: this.morphType,
      [this.foreignPivotKey]: id,
      ...extraAttributes,
    }));

    await knex(this.pivotTable).insert(rows);
  }

  async detach(relatedId?: any) {
    const knex = getKnex();
    const localKeyValue = this.parent.getAttribute(this.localKey);
    let q = knex(this.pivotTable)
      .where(this.relatedPivotKey, localKeyValue)
      .where(this.morphTypeColumn, this.morphType);

    if (relatedId !== undefined) {
      if (Array.isArray(relatedId)) {
        q = q.whereIn(this.foreignPivotKey, relatedId);
      } else {
        q = q.where(this.foreignPivotKey, relatedId);
      }
    }

    await q.delete();
  }

  async sync(ids: any[]) {
    await this.detach();
    if (ids.length > 0) {
      await this.attach(ids);
    }
  }

  async match(parents: Parent[], relationName: string): Promise<void> {
    const localKeys = Array.from(
      new Set(
        parents
          .map((p) => p.getAttribute(this.localKey))
          .filter((key) => key !== null && key !== undefined),
      ),
    );

    if (localKeys.length === 0) {
      for (const parent of parents) {
        parent.setRelation(relationName, []);
      }
      return;
    }

    const knex = getKnex();
    const relatedTable = this.related.table;

    const rows = await knex(relatedTable)
      .join(
        this.pivotTable,
        `${relatedTable}.${this.relatedKey}`,
        `${this.pivotTable}.${this.foreignPivotKey}`,
      )
      .whereIn(`${this.pivotTable}.${this.relatedPivotKey}`, localKeys)
      .where(`${this.pivotTable}.${this.morphTypeColumn}`, this.morphType)
      .select(
        `${relatedTable}.*`,
        `${this.pivotTable}.${this.relatedPivotKey} as _pivot_parent_key`,
      );

    const lookup = new Map<any, Related[]>();
    for (const row of rows) {
      const parentFk = row._pivot_parent_key;
      delete row._pivot_parent_key;

      const model = new this.related(row, false);
      if (!lookup.has(parentFk)) {
        lookup.set(parentFk, []);
      }
      lookup.get(parentFk)!.push(model);
    }

    for (const parent of parents) {
      const lk = parent.getAttribute(this.localKey);
      parent.setRelation(relationName, lookup.get(lk) || []);
    }
  }
}
