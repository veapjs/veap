"use client";

import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { getPluginExtensionsAction } from "../../actions";
import { onPluginsChanged } from "../events";

export interface PluginExtensionPointClientProps {
  target: string;
  point: string;
  mode?: "single" | "multiple";
  className?: string;
  props?: any;
  fallback?: React.ReactNode;
  children?: React.ReactNode;
  includeDisabled?: boolean;
  as?: React.ElementType;
}

export function usePluginExtensions(
  target: string,
  point: string,
  includeDisabled = false,
) {
  const [extensions, setExtensions] = useState<any[]>([]);

  const fetchExtensions = useCallback(() => {
    getPluginExtensionsAction(target, point, includeDisabled).then(
      setExtensions,
    );
  }, [target, point, includeDisabled]);

  useEffect(() => {
    fetchExtensions();

    const unsubscribe = onPluginsChanged(() => {
      fetchExtensions();
    });

    return unsubscribe;
  }, [fetchExtensions]);

  return extensions;
}

export function PluginExtensionPointClient({
  target,
  point,
  mode = "multiple",
  className,
  props,
  fallback,
  children,
  includeDisabled = false,
  as: Container,
}: PluginExtensionPointClientProps) {
  const extensions = usePluginExtensions(target, point, includeDisabled);

  const fallbackContent = (children ?? fallback ?? null) as React.ReactNode;

  if (extensions.length === 0) return fallbackContent;

  if (mode === "single") {
    const ext = extensions[0];
    const Component = ext?.component;
    if (!Component) return fallbackContent;

    if (Container || className) {
      const Wrapper = Container || "div";
      return (
        <Wrapper className={className}>
          <Component key={ext.id} {...props} />
        </Wrapper>
      );
    }

    return <Component key={ext.id} {...props} />;
  }

  const Wrapper = Container || "div";
  return (
    <Wrapper className={className}>
      {extensions.map((ext) => {
        const Component = ext.component;
        if (!Component) return null;
        return <Component key={ext.id} {...props} />;
      })}
    </Wrapper>
  );
}
