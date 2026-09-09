export type CastType =
  | "string"
  | "number"
  | "boolean"
  | "json"
  | "datetime"
  | "date"
  | (string & {});

/**
 * Casts raw database value to application/model representation.
 */
export function castAttribute(value: any, type: CastType): any {
  if (value === null || value === undefined) {
    return value;
  }

  switch (type) {
    case "string":
      return String(value);

    case "number": {
      const num = Number(value);
      return Number.isNaN(num) ? value : num;
    }

    case "boolean":
      return value === 1 || value === "1" || value === true || value === "true";

    case "json":
      if (typeof value === "string") {
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      }
      return value;

    case "datetime":
    case "date":
      if (value instanceof Date) {
        return value;
      }
      return new Date(value);

    default:
      return value;
  }
}

/**
 * Prepares model attribute value for database storage based on dialect.
 */
export function serializeForStorage(
  value: any,
  type: CastType | undefined,
  clientType?: string,
): any {
  if (value === null || value === undefined) {
    return null;
  }

  if (!type) {
    if (value instanceof Date) {
      // In SQLite dates are stored as ISO strings or timestamps
      if (clientType?.includes("sqlite")) {
        return value.toISOString();
      }
      return value;
    }
    if (typeof value === "object" && !(value instanceof Date)) {
      if (clientType?.includes("sqlite")) {
        return JSON.stringify(value);
      }
    }
    return value;
  }

  switch (type) {
    case "json":
      // Valid JSON in PostgreSQL (and SQLite) requires stringification for objects and primitives (string, number, boolean)
      return JSON.stringify(value);

    case "boolean":
      if (clientType?.includes("sqlite")) {
        return value ? 1 : 0;
      }
      return Boolean(value);

    case "datetime":
    case "date":
      if (value instanceof Date) {
        if (clientType?.includes("sqlite")) {
          return value.toISOString();
        }
        return value;
      }
      return value;

    default:
      return value;
  }
}
