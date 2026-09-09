import type { Model } from "../model";
import type { ModelQueryBuilder } from "../query-builder";
import { Relation } from "./relation";

export class HasOne<
  Parent extends Model = any,
  Related extends Model = any,
> extends Relation<Parent, Related> {
  query(): ModelQueryBuilder<Related> {
    const localKeyValue = this.parent.getAttribute(this.localKey);
    return this.related.query().where(this.foreignKey, localKeyValue);
  }

  async get(): Promise<Related | null> {
    const localKeyValue = this.parent.getAttribute(this.localKey);
    if (localKeyValue === null || localKeyValue === undefined) {
      return null;
    }
    return await this.query().first();
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
        parent.setRelation(relationName, null);
      }
      return;
    }

    const results: Related[] = await this.related
      .query()
      .whereIn(this.foreignKey, localKeys)
      .get();

    const lookup = new Map<any, Related>();
    for (const item of results) {
      lookup.set(item.getAttribute(this.foreignKey), item);
    }

    for (const parent of parents) {
      const lk = parent.getAttribute(this.localKey);
      parent.setRelation(relationName, lookup.get(lk) || null);
    }
  }
}
