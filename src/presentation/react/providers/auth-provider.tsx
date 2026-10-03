"use client";

import { PageLoader } from "@veap/ui/shared/page-loader";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { mutate } from "swr";
import {
  type AuthRoutesConfig,
  type AuthSession,
  DEFAULT_AUTH_ROUTES,
} from "../../../domain/auth/types";
import { PathPrefixContext } from "../../plugins/react/context/path-prefix-context";

export interface AuthContextValue {
  user: AuthSession["user"] | null | undefined;
  session: AuthSession["session"] | null | undefined;
  prefix: string;
  isLoading: boolean;
  refetchUser: () => Promise<void>;
  routes: AuthRoutesConfig;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({
  children,
  initialSession,
  prefix = "/app",
  routes: customRoutes,
}: {
  children: ReactNode;
  initialSession?: AuthSession;
  prefix?: string;
  routes?: Partial<AuthRoutesConfig>;
}) {
  const [isLoading, setIsLoading] = useState(true);

  const routes: AuthRoutesConfig = {
    ...DEFAULT_AUTH_ROUTES,
    ...customRoutes,
  };

  const refetchUser = async () => {
    mutate("user");
  };

  useEffect(() => {
    setTimeout(() => {
      setIsLoading(false);
    }, 200);
  }, []);

  if (isLoading) {
    return <PageLoader text="User checking" />;
  }

  return (
    <AuthContext.Provider
      value={{
        user: initialSession?.user,
        session: initialSession?.session,
        prefix,
        isLoading,
        refetchUser,
        routes,
      }}
    >
      <PathPrefixContext.Provider value={prefix}>{children}</PathPrefixContext.Provider>
    </AuthContext.Provider>
  );
}

/**
 * Hook to access configured authentication route URLs on the client.
 */
export function useAuthRoutes(): AuthRoutesConfig {
  const context = useContext(AuthContext);
  return context?.routes ?? DEFAULT_AUTH_ROUTES;
}
