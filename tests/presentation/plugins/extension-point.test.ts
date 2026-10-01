import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import { PluginExtensionPoint } from "../../../src/presentation/plugins/react/components/plugin-extension-point";
import { bindPluginsContext } from "../../../src/application/plugins/context";

vi.mock("../../../src/application/auth/facades/session", () => ({
  getCurrentSession: vi.fn().mockResolvedValue({ user: null }),
}));

describe("PluginExtensionPoint component", () => {
  const mockRegistry = {
    getExtensions: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    bindPluginsContext({
      registry: mockRegistry as any,
      navigation: {} as any,
    });
  });

  it("renders fallback when no extensions are registered", async () => {
    mockRegistry.getExtensions.mockResolvedValue([]);

    const result = await PluginExtensionPoint({
      target: "app",
      point: "footer",
      fallback: "default-footer",
    });

    expect(result).toBe("default-footer");
  });

  it("renders children as fallback when no extensions are registered", async () => {
    mockRegistry.getExtensions.mockResolvedValue([]);

    const result = await PluginExtensionPoint({
      target: "app",
      point: "footer",
      children: "children-fallback",
    });

    expect(result).toBe("children-fallback");
  });

  it("renders all extensions in mode='multiple' (default)", async () => {
    const CompA = () => React.createElement("div", null, "A");
    const CompB = () => React.createElement("div", null, "B");

    mockRegistry.getExtensions.mockResolvedValue([
      { id: "ext-1", component: CompA },
      { id: "ext-2", component: CompB },
    ]);

    const result = (await PluginExtensionPoint({
      target: "app",
      point: "sidebar",
    })) as React.ReactElement;

    expect(result.type).toBe("div");
    expect(React.Children.count(result.props.children)).toBe(2);
  });

  it("renders only the first (highest priority) extension in mode='single'", async () => {
    const CompA = () => React.createElement("div", null, "A");
    const CompB = () => React.createElement("div", null, "B");

    mockRegistry.getExtensions.mockResolvedValue([
      { id: "ext-highest", component: CompA },
      { id: "ext-lower", component: CompB },
    ]);

    const result = (await PluginExtensionPoint({
      target: "app",
      point: "footer",
      mode: "single",
    })) as React.ReactElement;

    // In mode='single' without Container or className, renders Component directly
    expect(result.type).toBe(CompA);
    expect(result.key).toBe("ext-highest");
  });
});
