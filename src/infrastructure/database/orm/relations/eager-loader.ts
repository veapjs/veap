import { AppError } from "../../../../domain/errors/app-error";
import type { Model } from "../model";

/**
 * Loads relations onto an array of model instances in bulk queries, avoiding N+1.
 */
export async function eagerLoadRelations<M extends Model>(
  models: M[],
  relations: string[],
): Promise<void> {
  if (models.length === 0 || relations.length === 0) {
    return;
  }

  // Parse nested relations, e.g. "posts.comments" -> { posts: ["comments"] }
  const tree: Record<string, string[]> = {};
  for (const rel of relations) {
    const parts = rel.split(".");
    const head = parts[0];
    const tail = parts.slice(1).join(".");

    if (!tree[head]) {
      tree[head] = [];
    }
    if (tail) {
      tree[head].push(tail);
    }
  }

  const sample = models[0];

  for (const [relationName, nestedRels] of Object.entries(tree)) {
    // Resolve relation instance from model (handling cases where loaded relation data shadows the method)
    let relationInstance: any = null;
    if (typeof (sample as any).getRelationDefinition === "function") {
      relationInstance = (sample as any).getRelationDefinition(relationName);
    }
    if (!relationInstance) {
      if (typeof (sample as any)[relationName] === "function") {
        relationInstance = (sample as any)[relationName]();
      } else {
        let proto = Object.getPrototypeOf(sample);
        while (proto && proto !== Object.prototype) {
          const desc = Object.getOwnPropertyDescriptor(proto, relationName);
          if (desc && typeof desc.value === "function") {
            relationInstance = desc.value.call(sample);
            break;
          }
          proto = Object.getPrototypeOf(proto);
        }
      }
    }

    if (!relationInstance) {
      throw AppError.Internal(
        `[veap:ORM] Relation "${relationName}" is not defined on model ${sample.constructor.name}.`,
      );
    }

    await relationInstance.match(models, relationName);

    // If there are nested relations, recursively eager load them on the children
    if (nestedRels.length > 0) {
      const allChildren: Model[] = [];
      for (const parent of models) {
        const childOrChildren = parent.getRelation(relationName);
        if (Array.isArray(childOrChildren)) {
          allChildren.push(...childOrChildren);
        } else if (childOrChildren) {
          allChildren.push(childOrChildren);
        }
      }

      if (allChildren.length > 0) {
        await eagerLoadRelations(allChildren, nestedRels);
      }
    }
  }
}
