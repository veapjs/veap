/**
 * Unified route matcher for Veap.
 * Supports standard parameters (:id) and catch-all patterns (:path(.*)).
 */
export function matchRoute(pattern: string, path: string) {
  const paramNames: string[] = [];
  let regexStr = pattern;

  // Replace :name(.*) (catch-all) and :name (dynamic) in a single pass so that
  // capture-group order always matches the order of placeholders in the
  // pattern. Doing it in two passes would collect catch-all names first even
  // when they appear after dynamic params in the pattern.
  regexStr = regexStr.replace(
    /:([a-zA-Z0-9_]+)\(\.\*\)|:([a-zA-Z0-9_]+)/g,
    (_, catchAllName: string | undefined, dynamicName: string | undefined) => {
      if (catchAllName) {
        paramNames.push(catchAllName);
        return "(.*)";
      }
      paramNames.push(dynamicName as string);
      return "([^\\/]+)";
    },
  );

  // Escape slashes
  regexStr = regexStr.replace(/\//g, "\\/");

  const regex = new RegExp(`^${regexStr}$`);
  const match = path.match(regex);

  if (!match) return null;

  const params: Record<string, string> = {};
  paramNames.forEach((name, index) => {
    // biome-ignore lint/style/noNonNullAssertion: We know the match exists and the index is valid
    params[name] = match[index + 1]!;
  });

  return params;
}
