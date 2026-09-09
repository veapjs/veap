import type { Model } from "../model";

const globalForMorph = globalThis as any;

/**
 * Registry storing polymorphic type aliases mapped to Model constructors and vice-versa.
 */
export class MorphMap {
  private static get aliasToModel(): Map<string, any> {
    if (!globalForMorph.__VEAP_MORPH_ALIAS_TO_MODEL__) {
      globalForMorph.__VEAP_MORPH_ALIAS_TO_MODEL__ = new Map<string, any>();
    }
    return globalForMorph.__VEAP_MORPH_ALIAS_TO_MODEL__;
  }

  private static get modelToAlias(): Map<any, string> {
    if (!globalForMorph.__VEAP_MORPH_MODEL_TO_ALIAS__) {
      globalForMorph.__VEAP_MORPH_MODEL_TO_ALIAS__ = new Map<any, string>();
    }
    return globalForMorph.__VEAP_MORPH_MODEL_TO_ALIAS__;
  }

  /**
   * Registers a mapping of aliases to Model constructors.
   *
   * Example:
   * MorphMap.register({
   *   post: BlogPost,
   *   user: User,
   *   comment: BlogComment,
   * });
   */
  static register(map: Record<string, any>): void {
    for (const [alias, modelClass] of Object.entries(map)) {
      this.aliasToModel.set(alias, modelClass);
      if (!this.modelToAlias.has(modelClass)) {
        this.modelToAlias.set(modelClass, alias);
      }
    }
  }

  /**
   * Gets the Model constructor registered for a given morph alias.
   * If not registered in morphMap, attempts to return the input if it's already a class.
   */
  static getModel(aliasOrName: string): any {
    return this.aliasToModel.get(aliasOrName) || null;
  }

  /**
   * Resolves the polymorphic string type for a model class or instance.
   * Returns the registered morph alias if exists, otherwise falls back to model table name or class name.
   */
  static getMorphAlias(modelClassOrInstance: any): string {
    const ctor =
      typeof modelClassOrInstance === "function"
        ? modelClassOrInstance
        : modelClassOrInstance?.constructor;

    if (ctor && this.modelToAlias.has(ctor)) {
      return this.modelToAlias.get(ctor)!;
    }

    if (ctor?.morphAlias) {
      this.register({ [ctor.morphAlias]: ctor });
      return ctor.morphAlias;
    }

    if (ctor?.table) {
      return ctor.table;
    }

    if (ctor?.name) {
      return ctor.name;
    }

    return String(modelClassOrInstance);
  }

  /**
   * Clears the morph map registry (mainly used for testing).
   */
  static clear(): void {
    this.aliasToModel.clear();
    this.modelToAlias.clear();
  }
}
