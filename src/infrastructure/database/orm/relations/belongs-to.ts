import type { Model } from "../model";
import type { ModelQueryBuilder } from "../query-builder";
import { Relation } from "./relation";

export class BelongsTo<
  Parent extends Model = any,
  Related extends Model = any,
> extends Relation<Parent, Related> {
  query(): ModelQueryBuilder<Related> {
    const foreignKeyValue = this.parent.getAttribute(this.foreignKey);
    return this.related.query().where(this.localKey, foreignKeyValue);
  }

  async get(): Promise<Related | null> {
    const foreignKeyValue = this.parent.getAttribute(this.foreignKey);
    if (foreignKeyValue === null || foreignKeyValue === undefined) {
      return null;
    }
    return await this.query().first();
  }

  async match(parents: Parent[], relationName: string): Promise<void> {
    const foreignKeys = Array.from(
      new Set(
        parents
          .map((p) => p.getAttribute(this.foreignKey))
          .filter((key) => key !== null && key !== undefined),
      ),
    );

    if (foreignKeys.length === 0) {
      for (const parent of parents) {
        parent.setRelation(relationName, null);
      }
      return;
    }

    const results: Related[] = await this.related
      .query()
      .whereIn(this.localKey, foreignKeys)
      .get();

    const lookup = new Map<any, Related>();
    for (const item of results) {
      lookup.set(item.getAttribute(this.localKey), item);
    }

    for (const parent of parents) {
      const fk = parent.getAttribute(this.foreignKey);
      parent.setRelation(relationName, lookup.get(fk) || null);
    }
  }
}
