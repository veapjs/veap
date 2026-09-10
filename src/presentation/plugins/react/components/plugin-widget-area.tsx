import type React from "react";
import { getCurrentSession } from "../../../../application/auth/facades/session";
import { pluginsContext } from "../../../../application/plugins/context";

interface PluginWidgetAreaProps {
  area: string;
  className?: string;
  props?: any;
  fallback?: React.ReactNode;
  as?: React.ElementType;
}

export async function PluginWidgetArea({
  area,
  className,
  props,
  fallback,
  as: Container = "div",
}: PluginWidgetAreaProps) {
  const { user } = await getCurrentSession();
  const userRoles = user?.roles || [];
  const userPermissions = user?.permissions || [];

  const widgets = await pluginsContext().registry.getWidgets(area, {
    roles: userRoles,
    permissions: userPermissions,
  });

  if (widgets.length === 0) return fallback || null;

  return (
    <Container className={className}>
      {widgets.map((widget) => {
        const Component = widget.component;
        return <Component key={widget.id} {...props} />;
      })}
    </Container>
  );
}
