"use client";

import { PageLoader } from "@veap/ui/shared/page-loader";
import type { AuthSession } from "../../../domain/auth/types";
import { PathPrefixContext } from "../../plugins/react/context/path-prefix-context";
import { createContext, type ReactNode, useEffect, useState } from "react";
import { mutate } from "swr";

export const AuthContext = createContext<
  | {
      user: AuthSession["user"] | null | undefined;
      session: AuthSession["session"] | null | undefined;
      prefix: string;
      isLoading: boolean;
      refetchUser: () => Promise<void>;
    }
  | undefined
>(undefined);

export function AuthProvider({
  children,
  initialSession,
  prefix = "/app",
}: {
  children: ReactNode;
  initialSession?: AuthSession;
  prefix?: string;
}) {
  const [isLoading, setIsLoading] = useState(true);

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
      }}
    >
      <PathPrefixContext.Provider value={prefix}>
        {children}
      </PathPrefixContext.Provider>
    </AuthContext.Provider>
  );
}
