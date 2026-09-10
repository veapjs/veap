"use client";

import { createContext, useContext } from "react";

export const PathPrefixContext = createContext<string>("/app");

/**
 * Hook to get the current Veap path prefix on the client.
 */
export function usePathPrefix() {
  return useContext(PathPrefixContext);
}
