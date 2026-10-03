import "reflect-metadata";

import type { Token } from "./token";

/**
 * Dependency-injection decorator contracts.
 *
 * These live in the domain (next to `token.ts`) because they are part of the
 * DI vocabulary that application services speak, not an implementation detail
 * of the container. They only record metadata; the infrastructure container
 * is the sole reader of it, so the dependency direction
 * `application → domain` and `infrastructure → domain` both stay intact.
 *
 * `reflect-metadata` is a global polyfill (no API surface), required so
 * `Reflect.defineMetadata` exists when decorated classes are evaluated.
 */

/**
 * Marks a class as injectable by the IoC container.
 * This decorator ensures that TypeScript emits the `design:paramtypes` metadata
 * so the container can resolve constructor dependencies.
 */
export function Injectable(): ClassDecorator {
  return (target: any) => {
    // We just need the decorator to exist so TS emits metadata.
    // Additional logic could be added here to auto-register to the global container,
    // but explicit registration via ServiceProviders is usually cleaner.
  };
}

/**
 * Overrides the default type-based injection with a specific token.
 * Useful for injecting interfaces or primitive values where TS types don't emit usable metadata.
 *
 * @example
 * constructor(@Inject('MyConfig') config: any) {}
 */
export function Inject(token: Token<any>): ParameterDecorator {
  return (
    target: any,
    propertyKey: string | symbol | undefined,
    parameterIndex: number,
  ) => {
    const customTokens: Map<number, Token<any>> = Reflect.getMetadata(
      "ioc:inject_params",
      target,
    ) || new Map();
    customTokens.set(parameterIndex, token);
    Reflect.defineMetadata("ioc:inject_params", customTokens, target);
  };
}
