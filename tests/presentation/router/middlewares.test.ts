import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiEnsuredAuth,
  EnsuredAuth,
  EnsuredGuest,
  EnsuredUser,
  SkipSecurity,
  runApiPipeline,
  runPipeline,
} from "../../../src/presentation/router/api/middlewares";
import type {
  ApiMiddleware,
  VeapMiddleware,
  VeapMiddlewareContext,
} from "../../../src/domain/plugins/types";

const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (url: string) => mockRedirect(url),
}));

const mockHeadersGet = vi.fn();
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({
    get: mockHeadersGet,
  })),
}));

const mockGetCurrentSession = vi.fn();
vi.mock("../../../src/application/auth/facades/session", () => ({
  getCurrentSession: () => mockGetCurrentSession(),
}));

const mockCheckSecurity = vi.fn();
vi.mock("../../../src/application/auth/logic", () => ({
  checkSecurity: (...args: any[]) => mockCheckSecurity(...args),
}));

describe("Router Middlewares", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("SkipSecurity", () => {
    it("sets __skipSecurity flag on context and calls next", async () => {
      const ctx: VeapMiddlewareContext = {
        path: "/gate-page",
        params: {},
        searchParams: {},
        roles: [],
        permissions: [],
      };
      const next = vi.fn(async () => "result");

      const result = await SkipSecurity(ctx, next);

      expect((ctx as any).__skipSecurity).toBe(true);
      expect(next).toHaveBeenCalledOnce();
      expect(result).toBe("result");
    });
  });

  describe("EnsuredGuest", () => {
    it("allows access when user is not logged in", async () => {
      mockGetCurrentSession.mockResolvedValue({ user: null, session: null });
      const ctx: VeapMiddlewareContext = {
        path: "/signin",
        params: {},
        searchParams: {},
      };
      const next = vi.fn(async () => "guest-page");

      const result = await EnsuredGuest(ctx, next);

      expect(next).toHaveBeenCalledOnce();
      expect(mockRedirect).not.toHaveBeenCalled();
      expect(result).toBe("guest-page");
    });

    it("redirects logged-in user to / when no referer", async () => {
      mockGetCurrentSession.mockResolvedValue({
        user: { id: "u1" },
        session: { id: "s1" },
      });
      mockHeadersGet.mockReturnValue(null);

      const ctx: VeapMiddlewareContext = {
        path: "/signin",
        params: {},
        searchParams: {},
      };
      const next = vi.fn();

      await EnsuredGuest(ctx, next);

      expect(mockRedirect).toHaveBeenCalledWith("/");
      expect(next).not.toHaveBeenCalled();
    });

    it("redirects logged-in user to referer if different from current path", async () => {
      mockGetCurrentSession.mockResolvedValue({
        user: { id: "u1" },
        session: { id: "s1" },
      });
      mockHeadersGet.mockReturnValue("https://example.com/dashboard");

      const ctx: VeapMiddlewareContext = {
        path: "/signin",
        params: {},
        searchParams: {},
      };
      const next = vi.fn();

      await EnsuredGuest(ctx, next);

      expect(mockRedirect).toHaveBeenCalledWith("https://example.com/dashboard");
      expect(next).not.toHaveBeenCalled();
    });

    it("redirects logged-in user to / if referer contains current path", async () => {
      mockGetCurrentSession.mockResolvedValue({
        user: { id: "u1" },
        session: { id: "s1" },
      });
      mockHeadersGet.mockReturnValue("https://example.com/signin?error=1");

      const ctx: VeapMiddlewareContext = {
        path: "/signin",
        params: {},
        searchParams: {},
      };
      const next = vi.fn();

      await EnsuredGuest(ctx, next);

      expect(mockRedirect).toHaveBeenCalledWith("/");
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("EnsuredUser", () => {
    it("redirects to /signin if user is not authenticated", async () => {
      mockGetCurrentSession.mockResolvedValue({ user: null, session: null });
      const ctx: VeapMiddlewareContext = {
        path: "/dashboard",
        params: {},
        searchParams: {},
      };
      const next = vi.fn();

      await EnsuredUser(ctx, next);

      expect(mockRedirect).toHaveBeenCalledWith("/signin");
      expect(next).not.toHaveBeenCalled();
    });

    it("calls next if user is authenticated", async () => {
      mockGetCurrentSession.mockResolvedValue({
        user: { id: "u1" },
        session: { id: "s1" },
      });
      const ctx: VeapMiddlewareContext = {
        path: "/dashboard",
        params: {},
        searchParams: {},
      };
      const next = vi.fn(async () => "dashboard-page");

      const result = await EnsuredUser(ctx, next);

      expect(mockRedirect).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledOnce();
      expect(result).toBe("dashboard-page");
    });
  });

  describe("EnsuredAuth", () => {
    it("redirects to /signin if unauthenticated", async () => {
      mockGetCurrentSession.mockResolvedValue({ user: null, session: null });
      const ctx: VeapMiddlewareContext = {
        path: "/admin",
        params: {},
        searchParams: {},
      };
      const next = vi.fn();

      await EnsuredAuth(ctx, next);

      expect(mockRedirect).toHaveBeenCalledWith("/signin");
      expect(next).not.toHaveBeenCalled();
    });

    it("redirects to security.redirect if checkSecurity fails", async () => {
      mockGetCurrentSession.mockResolvedValue({
        user: { id: "u1" },
        session: { id: "s1" },
      });
      mockCheckSecurity.mockResolvedValue({
        satisfied: false,
        redirect: "/2fa-challenge",
      });

      const ctx: VeapMiddlewareContext = {
        path: "/admin",
        params: {},
        searchParams: {},
      };
      const next = vi.fn();

      await EnsuredAuth(ctx, next);

      expect(mockCheckSecurity).toHaveBeenCalledWith(
        { id: "s1" },
        { id: "u1" },
        undefined,
        undefined,
        undefined,
        "/admin",
      );
      expect(mockRedirect).toHaveBeenCalledWith("/2fa-challenge");
      expect(next).not.toHaveBeenCalled();
    });

    it("proceeds to next when checkSecurity succeeds", async () => {
      mockGetCurrentSession.mockResolvedValue({
        user: { id: "u1" },
        session: { id: "s1" },
      });
      mockCheckSecurity.mockResolvedValue({ satisfied: true });

      const ctx: VeapMiddlewareContext = {
        path: "/admin",
        params: {},
        searchParams: {},
      };
      const next = vi.fn(async () => "admin-content");

      const result = await EnsuredAuth(ctx, next);

      expect(mockRedirect).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledOnce();
      expect(result).toBe("admin-content");
    });
  });

  describe("ApiEnsuredAuth", () => {
    it("returns 401 JSON when not authenticated", async () => {
      mockGetCurrentSession.mockResolvedValue({ user: null, session: null });
      const req = new Request("https://example.com/api/posts");
      const ctx = { path: "/api/posts" };
      const next = vi.fn();

      const response = await ApiEnsuredAuth(req, ctx, next);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data).toEqual({ error: "Unauthorized" });
      expect(next).not.toHaveBeenCalled();
    });

    it("returns 401 with redirect when checkSecurity fails", async () => {
      mockGetCurrentSession.mockResolvedValue({
        user: { id: "u1" },
        session: { id: "s1" },
      });
      mockCheckSecurity.mockResolvedValue({
        satisfied: false,
        redirect: "/onboarding",
      });

      const req = new Request("https://example.com/api/posts");
      const ctx = { path: "/api/posts" };
      const next = vi.fn();

      const response = await ApiEnsuredAuth(req, ctx, next);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data).toEqual({
        error: "Security requirement not met",
        redirect: "/onboarding",
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("calls next when authenticated and security satisfied", async () => {
      mockGetCurrentSession.mockResolvedValue({
        user: { id: "u1" },
        session: { id: "s1" },
      });
      mockCheckSecurity.mockResolvedValue({ satisfied: true });

      const req = new Request("https://example.com/api/posts");
      const ctx = { path: "/api/posts" };
      const next = vi.fn(async () => new Response("ok"));

      const response = await ApiEnsuredAuth(req, ctx, next);

      expect(response.status).toBe(200);
      expect(next).toHaveBeenCalledOnce();
    });
  });

  describe("runPipeline", () => {
    it("executes middlewares in order and terminates at final handler", async () => {
      const order: string[] = [];
      const m1: VeapMiddleware = async (_ctx, next) => {
        order.push("m1-start");
        const res = await next();
        order.push("m1-end");
        return res;
      };
      const m2: VeapMiddleware = async (_ctx, next) => {
        order.push("m2-start");
        const res = await next();
        order.push("m2-end");
        return res;
      };

      const ctx: VeapMiddlewareContext = {
        path: "/",
        params: {},
        searchParams: {},
      };

      const result = await runPipeline([m1, m2], ctx, async () => {
        order.push("final");
        return "page-content";
      });

      expect(result).toBe("page-content");
      expect(order).toEqual(["m1-start", "m2-start", "final", "m2-end", "m1-end"]);
    });

    it("allows a middleware to short-circuit the pipeline", async () => {
      const m1: VeapMiddleware = async () => "short-circuited";
      const m2: VeapMiddleware = vi.fn();

      const ctx: VeapMiddlewareContext = {
        path: "/",
        params: {},
        searchParams: {},
      };

      const final = vi.fn();
      const result = await runPipeline([m1, m2], ctx, final);

      expect(result).toBe("short-circuited");
      expect(m2).not.toHaveBeenCalled();
      expect(final).not.toHaveBeenCalled();
    });
  });

  describe("runApiPipeline", () => {
    it("executes API middlewares in order", async () => {
      const order: string[] = [];
      const m1: ApiMiddleware = async (_req, _ctx, next) => {
        order.push("m1");
        return await next();
      };
      const m2: ApiMiddleware = async (_req, _ctx, next) => {
        order.push("m2");
        return await next();
      };

      const req = new Request("https://example.com/api/test");
      const ctx = {};

      const response = await runApiPipeline([m1, m2], req, ctx, async () => {
        order.push("final");
        return new Response("done");
      });

      expect(await response.text()).toBe("done");
      expect(order).toEqual(["m1", "m2", "final"]);
    });
  });
});
