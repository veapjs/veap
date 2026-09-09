import type { Model } from "../model";
import type { ModelQueryBuilder } from "../query-builder";
import { MorphMap } from "./morph-map";
import { Relation } from "./relation";

export class MorphOne<
  Parent extends Model = any,
  Related extends Model = any,
> extends Relation<Parent, Related> {
  public morphType: string;

  constructor(
    parent: Parent,
    related: any,
    public morphName: string,
    public typeColumn: string,
    public idColumn: string,
    localKey = (parent.constructor as typeof Model).primaryKey || "id",
  ) {
    super(parent, related, idColumn, localKey);
    this.morphType = MorphMap.getMorphAlias(parent);
  }

  query(): ModelQueryBuilder<Related> {
    const localKeyValue = this.parent.getAttribute(this.localKey);
    return this.related
      .query()
      .where(this.typeColumn, this.morphType)
      .where(this.idColumn, localKeyValue);
  }

  async get(): Promise<Related | null> {
    const localKeyValue = this.parent.getAttribute(this.localKey);
    if (localKeyValue === null || localKeyValue === undefined) {
      return null;
    }
    const result = await this.query().first();
    return result || null;
  }

  async create(attributes: Record<string, any> = {}): Promise<Related> {
    const localKeyValue = this.parent.getAttribute(this.localKey);
    return await this.related.create({
      ...attributes,
      [this.typeColumn]: this.morphType,
      [this.idColumn]: localKeyValue,
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
        parent.setRelation(relationName, null);
      }
      return;
    }

    const results: Related[] = await this.related
      .query()
      .where(this.typeColumn, this.morphType)
      .whereIn(this.idColumn, localKeys)
      .get();

    const lookup = new Map<any, Related>();
    for (const item of results) {
      const fk = item.getAttribute(this.idColumn);
      if (!lookup.has(fk)) {
        lookup.set(fk, item);
      }
    }

    for (const parent of parents) {
      const lk = parent.getAttribute(this.localKey);
      parent.setRelation(relationName, lookup.get(lk) || null);
    }
  }
}
