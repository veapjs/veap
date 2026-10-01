import type React from "react";
import { getCurrentSession } from "../../../../application/auth/facades/session";
import { pluginsContext } from "../../../../application/plugins/context";

export interface PluginExtensionPointProps {
  target: string;
  point: string;
  mode?: "single" | "multiple";
  className?: string;
  props?: any;
  fallback?: React.ReactNode;
  children?: React.ReactNode;
  as?: React.ElementType;
  includeDisabled?: boolean;
}

export async function PluginExtensionPoint({
  target,
  point,
  mode = "multiple",
  className,
  props,
  fallback,
  children,
  as: Container,
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
