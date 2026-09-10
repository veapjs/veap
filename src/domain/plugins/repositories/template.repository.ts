/**
 * Template persistence port.
 *
 * Templates are stored in the same `plugins` table under the `template:<id>`
 * synthetic id, but the application layer should not know that - this port
 * speaks purely in template terms.
 */
export interface ITemplateRepository {
  /** Creates the template row if it does not exist yet (idempotent). */
  ensureRegistered(
    id: string,
    defaultConfig: Record<string, any> | undefined,
  ): Promise<void>;

  /** Returns the stored config JSON string, or `null`. */
  findConfigJson(id: string): Promise<string | null>;

  /** Creates or updates the stored config JSON. */
  saveConfigJson(id: string, configJson: string): Promise<void>;
}

/** Injection token for the template repository port. */
export const TEMPLATE_REPOSITORY = Symbol.for(
  "veap:plugins:template-repository",
);
