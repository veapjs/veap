/**
 * Backwards-compatible re-export: the DI decorators are canonical in
 * `domain/contracts/ioc.ts` (same reasoning as the `Token` type); the
 * infrastructure layer only exposes them.
 */
export { Injectable, Inject } from "../../domain/contracts/ioc";
