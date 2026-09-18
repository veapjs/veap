import { describe, expect, it } from "vitest";
import { matchRoute } from "../../../src/application/router/matcher";
import {
  RouteTree,
  extractParamName,
  isCatchAllSegment,
  isDynamicSegment,
  isGroupSegment,
  isOptionalCatchAllSegment,
  isParallelSlot,
  resolveMagicPrefix,
} from "../../../src/application/router/route-tree";

describe("Route Segment Utils", () => {
  it("detects route group segments", () => {
    expect(isGroupSegment("(marketing)")).toBe(true);
    expect(isGroupSegment("(auth)")).toBe(true);
    expect(isGroupSegment("marketing")).toBe(false);
    expect(isGroupSegment("[id]")).toBe(false);
  });

  it("detects dynamic parameter segments", () => {
    expect(isDynamicSegment("[id]")).toBe(true);
    expect(isDynamicSegment("[slug]")).toBe(true);
    expect(isDynamicSegment("[...path]")).toBe(false);
    expect(isDynamicSegment("id")).toBe(false);
  });

  it("detects catch-all segments", () => {
    expect(isCatchAllSegment("[...path]")).toBe(true);
    expect(isCatchAllSegment("[...slug]")).toBe(true);
    expect(isCatchAllSegment("[id]")).toBe(false);
    expect(isCatchAllSegment("path")).toBe(false);
  });

  it("detects optional catch-all segments", () => {
    expect(isOptionalCatchAllSegment("[[...path]]")).toBe(true);
    expect(isOptionalCatchAllSegment("[[...slug]]")).toBe(true);
    expect(isOptionalCatchAllSegment("[...path]")).toBe(false);
    expect(isOptionalCatchAllSegment("[id]")).toBe(false);
  });

  it("detects parallel route slots", () => {
    expect(isParallelSlot("@sidebar")).toBe(true);
    expect(isParallelSlot("@modal")).toBe(true);
    expect(isParallelSlot("sidebar")).toBe(false);
  });

  it("extracts parameter names correctly", () => {
    expect(extractParamName("[id]")).toBe("id");
    expect(extractParamName("[slug]")).toBe("slug");
    expect(extractParamName("[...path]")).toBe("path");
    expect(extractParamName("[[...all]]")).toBe("all");
  });

  it("resolves magic prefix [prefix]", () => {
    const node = {
      segment: "",
      children: [
        {
          segment: "[prefix]",
          children: [{ segment: "settings" }],
        },
      ],
    };
    const resolved = resolveMagicPrefix(node, "/admin");
    expect(resolved.children?.[0].segment).toBe("admin");
    expect(resolved.children?.[0].children?.[0].segment).toBe("settings");
  });
});

describe("matchRoute", () => {
  it("matches static routes", () => {
    const result = matchRoute("/users/profile", "/users/profile");
    expect(result).toEqual({});
  });

  it("returns null for non-matching routes", () => {
    const result = matchRoute("/users/profile", "/posts/list");
    expect(result).toBeNull();
  });

  it("matches dynamic parameters", () => {
    const result = matchRoute("/users/:id", "/users/123");
    expect(result).toEqual({ id: "123" });
  });

  it("matches multiple dynamic parameters", () => {
    const result = matchRoute(
      "/org/:orgId/users/:userId",
      "/org/acme/users/42",
    );
    expect(result).toEqual({ orgId: "acme", userId: "42" });
  });

  it("matches catch-all parameters", () => {
    const result = matchRoute("/docs/:path(.*)", "/docs/guide/getting-started");
    expect(result).toEqual({ path: "guide/getting-started" });
  });
});

describe("RouteTree Matching", () => {
  it("matches root and nested static pages", () => {
    const tree = new RouteTree({
      segment: "",
      page: (() => null) as any,
      children: [
        {
          segment: "about",
          page: (() => null) as any,
        },
      ],
    });

    const rootMatch = tree.match("/");
    expect(rootMatch).not.toBeNull();
    expect(rootMatch?.node.page).toBeDefined();

    const aboutMatch = tree.match("/about");
    expect(aboutMatch).not.toBeNull();
    expect(aboutMatch?.node.page).toBeDefined();

    const missingMatch = tree.match("/contact");
    expect(missingMatch?.isExact).toBe(false);
  });

  it("matches dynamic routes with params", () => {
    const tree = new RouteTree({
      segment: "",
      children: [
        {
          segment: "posts",
          children: [
            {
              segment: "[id]",
              page: (() => null) as any,
            },
          ],
        },
      ],
    });

    const match = tree.match("/posts/456");
    expect(match).not.toBeNull();
    expect(match?.params).toEqual({ id: "456" });
  });

  it("matches transparent route groups without affecting URL", () => {
    const DummyLayout = (() => null) as any;
    const DummyPage = (() => null) as any;

    const tree = new RouteTree({
      segment: "",
      children: [
        {
          segment: "(marketing)",
          layout: DummyLayout,
          children: [
            {
              segment: "pricing",
              page: DummyPage,
            },
          ],
        },
      ],
    });

    const match = tree.match("/pricing");
    expect(match).not.toBeNull();
    expect(match?.node.page).toBe(DummyPage);
    expect(match?.layoutChain.some((l) => l.layout === DummyLayout)).toBe(true);
  });

  it("matches catch-all routes", () => {
    const tree = new RouteTree({
      segment: "",
      children: [
        {
          segment: "docs",
          children: [
            {
              segment: "[...slug]",
              page: (() => null) as any,
            },
          ],
        },
      ],
    });

    const match = tree.match("/docs/a/b/c");
    expect(match).not.toBeNull();
    expect(match?.params.slug).toBe("a/b/c");
  });

  it("matches optional catch-all with and without segments", () => {
    const tree = new RouteTree({
      segment: "",
      children: [
        {
          segment: "app",
          children: [
            {
              segment: "[[...catchAll]]",
              page: (() => null) as any,
            },
          ],
        },
      ],
    });

    const matchEmpty = tree.match("/app");
    expect(matchEmpty).not.toBeNull();

    const matchNested = tree.match("/app/dashboard/settings");
    expect(matchNested).not.toBeNull();
    expect(matchNested?.params.catchAll).toBe("dashboard/settings");
  });
});
