import { AppError } from "../../../../domain/errors/app-error";
import type { Model } from "../model";
import type { ModelQueryBuilder } from "../query-builder";
import { MorphMap } from "./morph-map";
import { Relation } from "./relation";

export class MorphTo<
  Child extends Model = any,
  Parent extends Model = any,
> extends Relation<Child, Parent> {
  constructor(
    parent: Child,
    public morphName: string,
    public typeColumn: string,
    public idColumn: string,
  ) {
    // The related model class will be dynamically resolved from typeColumn
    super(parent, null as any, idColumn, "id");
  }

  /**
   * Resolves the parent model class based on child's type column value.
   */
  resolveModel(): any {
    const typeValue = this.parent.getAttribute(this.typeColumn);
    if (!typeValue) {
      return null;
    }

    const modelClass = MorphMap.getModel(typeValue);
    if (!modelClass) {
      throw AppError.Internal(
        `[veap:ORM] Cannot resolve polymorphic model for morph type "${typeValue}". Did you register it with MorphMap.register()?`,
      );
    }
    return modelClass;
  }

  query(): ModelQueryBuilder<Parent> {
    const modelClass = this.resolveModel();
    if (!modelClass) {
      throw AppError.Internal(
        `[veap:ORM] Cannot create query for morphTo relation "${this.morphName}" because type column "${this.typeColumn}" is null.`,
      );
    }

    const idValue = this.parent.getAttribute(this.idColumn);
    const pk = modelClass.primaryKey || "id";
    return modelClass.query().where(pk, idValue);
  }

  async get(): Promise<Parent | null> {
    const modelClass = this.resolveModel();
    const idValue = this.parent.getAttribute(this.idColumn);
    if (!modelClass || !idValue) {
      return null;
    }

    const pk = modelClass.primaryKey || "id";
    const result = await modelClass.query().where(pk, idValue).first();
    return result || null;
  }

  /**
   * Eager load polymorphic parents for multiple children in bulk queries grouped by morph type.
   */
  async match(children: Child[], relationName: string): Promise<void> {
    // Group child records by morph type: typeValue -> ids
    const typeToIds = new Map<string, Set<any>>();
    for (const child of children) {
      const typeValue = child.getAttribute(this.typeColumn);
      const idValue = child.getAttribute(this.idColumn);
      if (typeValue && idValue) {
        if (!typeToIds.has(typeValue)) {
          typeToIds.set(typeValue, new Set());
        }
        typeToIds.get(typeValue)!.add(idValue);
      }
    }

    // Lookup map: `${typeValue}:${idValue}` -> Parent instance
    const lookup = new Map<string, Parent>();

    // For each unique type, execute ONE bulk query (e.g. BlogPost.query().whereIn('id', ids))
    for (const [typeValue, idSet] of typeToIds.entries()) {
      const modelClass = MorphMap.getModel(typeValue);
      if (!modelClass) {
        continue;
      }

      const pk = modelClass.primaryKey || "id";
      const parents: Parent[] = await modelClass
        .query()
        .whereIn(pk, Array.from(idSet))
        .get();

      for (const parent of parents) {
        const id = parent.getAttribute(pk);
        lookup.set(`${typeValue}:${id}`, parent);
      }
    }

    // Attach resolved parent to each child
    for (const child of children) {
      const typeValue = child.getAttribute(this.typeColumn);
      const idValue = child.getAttribute(this.idColumn);
      const key = `${typeValue}:${idValue}`;
      child.setRelation(relationName, lookup.get(key) || null);
    }
  }
}
