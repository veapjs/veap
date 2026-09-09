import { AppError } from "../../../domain/errors/app-error";
import type { Model } from "./model";

export abstract class Factory<M extends Model = any> {
  private static get registry(): Map<any, any> {
    const g = globalThis as any;
    if (!g.__VEAP_FACTORY_REGISTRY__) {
      g.__VEAP_FACTORY_REGISTRY__ = new Map<any, any>();
    }
    return g.__VEAP_FACTORY_REGISTRY__;
  }

  /**
   * Registers a factory class/instance for a model.
   */
  static register(modelClass: any, factoryOrFactoryFn: any) {
    this.registry.set(modelClass, factoryOrFactoryFn);
  }

  /**
   * Gets the registered factory for a model if one exists.
   */
  static getForModel(modelClass: any) {
    return this.registry.get(modelClass);
  }

  protected modelClass: any;
  protected countNumber = 1;
  protected states: Array<
    | Record<string, any>
    | ((attributes: Record<string, any>) => Record<string, any>)
  > = [];
  protected sequenceItems: Array<Record<string, any>> = [];

  constructor(modelClass?: any) {
    if (modelClass) {
      this.modelClass = modelClass;
    }
  }

  /**
   * Defines the default model attributes.
   */
  abstract definition(): Record<string, any> | Promise<Record<string, any>>;

  /**
   * Sets the number of models that should be generated.
   */
  count(amount: number): this {
    this.countNumber = Math.max(1, amount);
    return this;
  }

  /**
   * Applies an attribute state transformation to the factory.
   */
  state(
    override:
      | Record<string, any>
      | ((attributes: Record<string, any>) => Record<string, any>),
  ): this {
    this.states.push(override);
    return this;
  }

  /**
   * Applies sequential states rotating through the given items.
   */
  sequence(...items: Record<string, any>[]): this {
    this.sequenceItems.push(...items);
    return this;
  }

  /**
   * Generates the raw attributes dictionary for a single model instance.
   */
  async raw(
    override: Record<string, any> = {},
    index = 0,
  ): Promise<Record<string, any>> {
    let attributes = await this.definition();

    // Apply sequence if provided
    if (this.sequenceItems.length > 0) {
      const seqState = this.sequenceItems[index % this.sequenceItems.length];
      attributes = { ...attributes, ...seqState };
    }

    // Apply states
    for (const stateItem of this.states) {
      if (typeof stateItem === "function") {
        attributes = { ...attributes, ...stateItem(attributes) };
      } else {
        attributes = { ...attributes, ...stateItem };
      }
    }

    // Apply direct overrides
    attributes = { ...attributes, ...override };

    return attributes;
  }

  /**
   * Creates a single model instance in memory without saving to database.
   */
  async makeOne(override: Record<string, any> = {}, index = 0): Promise<M> {
    if (!this.modelClass) {
      throw AppError.Internal(
        "[veap:Factory] Model class is not defined for this factory.",
      );
    }
    const attributes = await this.raw(override, index);
    return new this.modelClass(attributes, true);
  }

  /**
   * Creates model instance(s) in memory without saving to database.
   */
  async make(override: Record<string, any> = {}): Promise<M | M[]> {
    if (this.countNumber === 1) {
      return await this.makeOne(override, 0);
    }

    const instances: M[] = [];
    for (let i = 0; i < this.countNumber; i++) {
      instances.push(await this.makeOne(override, i));
    }
    return instances;
  }

  /**
   * Creates and persists a single model instance to the database.
   */
  async createOne(override: Record<string, any> = {}, index = 0): Promise<M> {
    const instance = await this.makeOne(override, index);
    await instance.save();
    return instance;
  }

  /**
   * Creates and persists model instance(s) to the database.
   */
  async create(override: Record<string, any> = {}): Promise<M | M[]> {
    if (this.countNumber === 1) {
      return await this.createOne(override, 0);
    }

    const instances: M[] = [];
    for (let i = 0; i < this.countNumber; i++) {
      instances.push(await this.createOne(override, i));
    }
    return instances;
  }
}

/**
 * Generic factory implementation used by defineFactory helper.
 */
class GenericFactory<M extends Model = any> extends Factory<M> {
  constructor(
    modelClass: any,
    private definitionFn: () =>
      Record<string, any> | Promise<Record<string, any>>,
  ) {
    super(modelClass);
  }

  async definition(): Promise<Record<string, any>> {
    return await this.definitionFn();
  }
}

export interface FactoryConstructor<M extends Model = any> {
  new (): Factory<M>;
  (count?: number): Factory<M>;
  count(amount: number): Factory<M>;
  state(
    override: Record<string, any> | ((attrs: any) => Record<string, any>),
  ): Factory<M>;
  sequence(...items: Record<string, any>[]): Factory<M>;
  make(override?: Record<string, any>): Promise<M | M[]>;
  makeOne(override?: Record<string, any>): Promise<M>;
  create(override?: Record<string, any>): Promise<M | M[]>;
  createOne(override?: Record<string, any>): Promise<M>;
}

/**
 * Convenient helper to define a Model Factory in a single concise call.
 */
export function defineFactory<M extends Model = any>(
  modelClass: new (...args: any[]) => M,
  definitionFn: () => Record<string, any> | Promise<Record<string, any>>,
): FactoryConstructor<M> {
  const FactoryClass = class extends GenericFactory<M> {
    constructor() {
      super(modelClass, definitionFn);
    }
  };

  const factoryCallable = function (count?: number): Factory<M> {
    const instance = new FactoryClass();
    if (count !== undefined) {
      instance.count(count);
    }
    return instance;
  } as unknown as FactoryConstructor<M>;

  // Attach static factory shortcuts
  factoryCallable.count = (amount: number) => factoryCallable().count(amount);
  factoryCallable.state = (override: any) => factoryCallable().state(override);
  factoryCallable.sequence = (...items: any[]) =>
    factoryCallable().sequence(...items);
  factoryCallable.make = (override?: any) => factoryCallable().make(override);
  factoryCallable.makeOne = (override?: any) =>
    factoryCallable().makeOne(override);
  factoryCallable.create = (override?: any) =>
    factoryCallable().create(override);
  factoryCallable.createOne = (override?: any) =>
    factoryCallable().createOne(override);

  // Allow `new UserFactory()`
  Object.setPrototypeOf(factoryCallable, FactoryClass);
  factoryCallable.prototype = FactoryClass.prototype;

  return factoryCallable;
}
