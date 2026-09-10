"use client";

import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { getPluginWidgetsAction } from "../../actions";
import { onPluginsChanged } from "../events";

interface PluginWidgetAreaClientProps {
  area: string;
  className?: string;
  props?: any;
  fallback?: React.ReactNode;
  as?: React.ElementType;
}

export function usePluginWidgets(area: string) {
  const [widgets, setWidgets] = useState<any[]>([]);

  const fetchWidgets = useCallback(() => {
    getPluginWidgetsAction(area).then(setWidgets);
  }, [area]);

  useEffect(() => {
    fetchWidgets();

    const unsubscribe = onPluginsChanged(() => {
      fetchWidgets();
    });

    return unsubscribe;
  }, [fetchWidgets]);

  return widgets;
}

export function PluginWidgetAreaClient({
  area,
  className,
  props,
  fallback,
  as: Container = "div",
}: PluginWidgetAreaClientProps) {
  const widgets = usePluginWidgets(area);

  if (widgets.length === 0) return (fallback as any) || null;

  return (
    <Container className={className}>
      {widgets.map((widget) => {
        const Component = widget.component;
        if (!Component) return null;
        return <Component key={widget.id} {...props} />;
      })}
    </Container>
  );
}
