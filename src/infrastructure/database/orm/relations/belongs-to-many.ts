import { getKnex } from "../connection";
import type { Model } from "../model";
import type { ModelQueryBuilder } from "../query-builder";
import { Relation } from "./relation";

export class BelongsToMany<
  Parent extends Model = any,
  Related extends Model = any,
> extends Relation<Parent, Related> {
  constructor(
    parent: Parent,
    related: any,
    public pivotTable: string,
    public foreignPivotKey: string,
    public relatedPivotKey: string,
    localKey = "id",
    public relatedKey = "id",
  ) {
    super(parent, related, foreignPivotKey, localKey);
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
      .where(`${this.pivotTable}.${this.foreignPivotKey}`, localKeyValue);
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

    await knex(this.pivotTable).insert({
      [this.foreignPivotKey]: localKeyValue,
      [this.relatedPivotKey]: relatedId,
      ...extraAttributes,
    });
  }

  async detach(relatedId?: any) {
    const knex = getKnex();
    const localKeyValue = this.parent.getAttribute(this.localKey);
    let q = knex(this.pivotTable).where(this.foreignPivotKey, localKeyValue);

    if (relatedId !== undefined) {
      q = q.where(this.relatedPivotKey, relatedId);
    }

    await q.delete();
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

    // Fetch related records joined with the pivot table so we can associate by foreignPivotKey
    const rows = await knex(relatedTable)
      .join(
        this.pivotTable,
        `${relatedTable}.${this.relatedKey}`,
        `${this.pivotTable}.${this.relatedPivotKey}`,
      )
      .whereIn(`${this.pivotTable}.${this.foreignPivotKey}`, localKeys)
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
