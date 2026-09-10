import type React from "react";
import { getCurrentSession } from "../../../../application/auth/facades/session";
import { pluginsContext } from "../../../../application/plugins/context";

interface PluginExtensionPointProps {
  target: string;
  point: string;
  className?: string;
  props?: any;
  fallback?: React.ReactNode;
  as?: React.ElementType;
  includeDisabled?: boolean;
}

export async function PluginExtensionPoint({
  target,
  point,
  className,
  props,
  fallback,
  as: Container = "div",
  includeDisabled = false,
}: PluginExtensionPointProps) {
  const { user } = await getCurrentSession();
  const userRoles = user?.roles || [];
  const userPermissions = user?.permissions || [];

  const extensions = await pluginsContext().registry.getExtensions(
    target,
    point,
    includeDisabled,
    {
      roles: userRoles,
      permissions: userPermissions,
    },
  );

  if (extensions.length === 0) return fallback || null;

  return (
    <Container className={className}>
      {extensions.map((ext) => {
        const Component = ext.component;
        return <Component key={ext.id} {...props} />;
      })}
    </Container>
  );
}
