/**
 * Converts camelCase to snake_case.
 * Handles dotted notation (e.g. 'table.columnName' -> 'table.column_name').
 */
export function toSnakeCase(str: string): string {
  if (!str) return str;
  if (str.includes(".")) {
    return str.split(".").map(toSnakeCase).join(".");
  }
  return str.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}

/**
 * Converts snake_case to camelCase.
 */
export function toCamelCase(str: string): string {
  if (!str) return str;
  return str.replace(/_([a-z0-9])/g, (_, letter) => letter.toUpperCase());
}
