"use client";

import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { getPluginExtensionsAction } from "../../actions";
import { onPluginsChanged } from "../events";

interface PluginExtensionPointClientProps {
  target: string;
  point: string;
  className?: string;
  props?: any;
  fallback?: React.ReactNode;
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
  className,
  props,
  fallback,
  includeDisabled = false,
  as: Container = "div",
}: PluginExtensionPointClientProps) {
  const extensions = usePluginExtensions(target, point, includeDisabled);

  if (extensions.length === 0) return (fallback as any) || null;

  return (
    <Container className={className}>
      {extensions.map((ext) => {
        const Component = ext.component;
        if (!Component) return null;
        return <Component key={ext.id} {...props} />;
      })}
    </Container>
  );
}
