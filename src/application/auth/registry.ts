/**
 * Generic callback registry supporting both keyed (string ID) and anonymous registrations.
 * Implements Iterable<T> so it can be looped directly in `for (const fn of registry)`.
 * Also implements Set-like methods (.add, .delete, .has, .size) for backward compatibility.
 */
export class AuthCallbackRegistry<T extends Function> implements Iterable<T> {
  private keyed = new Map<string, T>();
  private anonymous = new Set<T>();

  /**
   * Registers a callback with an optional string ID.
   * If registered with a string ID, re-registering with the same ID replaces the previous handler.
   */
  public register(idOrHandler: string | T, maybeHandler?: T): void {
    if (typeof idOrHandler === "string") {
      if (!maybeHandler) {
        throw new Error(
          `[AuthCallbackRegistry] A handler function must be provided when registering with ID "${idOrHandler}".`,
        );
      }
      this.keyed.set(idOrHandler, maybeHandler);
    } else {
      this.anonymous.add(idOrHandler);
    }
  }

  /**
   * Unregisters a callback by its string ID or function reference.
   * Returns true if an entry was removed, false otherwise.
   */
  public unregister(idOrHandler: string | T): boolean {
    if (typeof idOrHandler === "string") {
      return this.keyed.delete(idOrHandler);
    }

    let removed = this.anonymous.delete(idOrHandler);
    for (const [key, handler] of this.keyed.entries()) {
      if (handler === idOrHandler) {
        this.keyed.delete(key);
        removed = true;
      }
    }
    return removed;
  }

  /**
   * Iterable implementation so `for (const fn of registry)` works seamlessly.
   */
  public *[Symbol.iterator](): Iterator<T> {
    yield* this.keyed.values();
    yield* this.anonymous.values();
  }

  // Set-compatible interface for backward compatibility
  public add(handler: T): this {
    this.anonymous.add(handler);
    return this;
  }

  public delete(idOrHandler: string | T): boolean {
    return this.unregister(idOrHandler);
  }

  public has(idOrHandler: string | T): boolean {
    if (typeof idOrHandler === "string") {
      return this.keyed.has(idOrHandler);
    }
    if (this.anonymous.has(idOrHandler)) {
      return true;
    }
    for (const handler of this.keyed.values()) {
      if (handler === idOrHandler) return true;
    }
    return false;
  }

  public clear(): void {
    this.keyed.clear();
    this.anonymous.clear();
  }

  public get size(): number {
    return this.keyed.size + this.anonymous.size;
  }
}
