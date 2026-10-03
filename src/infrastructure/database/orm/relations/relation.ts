import type { Model } from "../model";
import type { ModelQueryBuilder } from "../query-builder";

export abstract class Relation<
  Parent extends Model = any,
  Related extends Model = any,
> {
  constructor(
    public parent: Parent,
    public related: any, // typeof Model
    public foreignKey: string,
    public localKey: string,
  ) {}

  /**
   * Returns a new query builder pre-scoped for this relation.
   */
  abstract query(): ModelQueryBuilder<Related>;

  /**
   * Fetches the related model(s) for the parent instance.
   */
  abstract get(): Promise<any>;

  /**
   * Eager loads related models for an array of parents in a single bulk query (N+1 solver).
   */
  abstract match(parents: Parent[], relationName: string): Promise<void>;
}
