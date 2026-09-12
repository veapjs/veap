"use client";

import { Toaster } from "@veap/ui/components/sonner";
import { TooltipProvider } from "@veap/ui/components/tooltip";
import { ThemeProvider } from "@veap/ui/providers";
import { PageLoader } from "@veap/ui/shared/page-loader";
import type { AuthSession } from "../../../domain/auth/types";
import type * as React from "react";
import { useEffect, useState } from "react";
import { SWRConfig } from "swr";
import { AuthProvider } from "./auth-provider";

export const AppProvider = ({
  children,
  initialSession,
  prefix,
}: {
  children: React.ReactElement;
  initialSession?: AuthSession;
  prefix?: string;
}) => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setTimeout(() => {
      setIsLoading(false);
    }, 200);
  }, []);

  if (isLoading) {
    return (
      <ThemeProvider>
        <PageLoader text="Initializing" />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <SWRConfig
        value={{
          fetcher: (url: string) =>
            fetch(url).then((response) => response.json()),
          revalidateIfStale: true,
        }}
      >
        <AuthProvider initialSession={initialSession} prefix={prefix}>
          <TooltipProvider>
            {children}

            <Toaster position="top-right" expand={true} />
          </TooltipProvider>
        </AuthProvider>
      </SWRConfig>
    </ThemeProvider>
  );
};
