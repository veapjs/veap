import type { Model } from "../model";
import type { ModelQueryBuilder } from "../query-builder";
import { Relation } from "./relation";

export class HasMany<
  Parent extends Model = any,
  Related extends Model = any,
> extends Relation<Parent, Related> {
  query(): ModelQueryBuilder<Related> {
    const localKeyValue = this.parent.getAttribute(this.localKey);
    return this.related.query().where(this.foreignKey, localKeyValue);
  }

  async get(): Promise<Related[]> {
    const localKeyValue = this.parent.getAttribute(this.localKey);
    if (localKeyValue === null || localKeyValue === undefined) {
      return [];
    }
    return await this.query().get();
  }

  async create(attributes: Record<string, any> = {}): Promise<Related> {
    const localKeyValue = this.parent.getAttribute(this.localKey);
    return await this.related.create({
      ...attributes,
      [this.foreignKey]: localKeyValue,
    });
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

    const results: Related[] = await this.related
      .query()
      .whereIn(this.foreignKey, localKeys)
      .get();

    const lookup = new Map<any, Related[]>();
    for (const item of results) {
      const fk = item.getAttribute(this.foreignKey);
      if (!lookup.has(fk)) {
        lookup.set(fk, []);
      }
      lookup.get(fk)!.push(item);
    }

    for (const parent of parents) {
      const lk = parent.getAttribute(this.localKey);
      parent.setRelation(relationName, lookup.get(lk) || []);
    }
  }
}
