import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.ENCRYPTION_KEY = "MDEyMzQ1Njc4OWFiY2RlZg==";
});

import { Application } from "../../../src/infrastructure/composition/application";
import { container } from "../../../src/infrastructure/ioc/container";
import { getAuthRoutes } from "../../../src/application/auth/context";
import { RouterService } from "../../../src/application/router/router.service";
import { DEFAULT_AUTH_ROUTES } from "../../../src/domain/auth/types";

describe("Auth Routes Configuration and Rewrites", () => {
  beforeEach(() => {
    const g = globalThis as any;
    delete g.__VEAP_BOOTSTRAPPED__;
    delete g.__VEAP_BOOTSTRAPPING_PROMISE__;
    delete g.__VEAP_AUTH_CONTEXT__;
    container.clear();
  });

  afterEach(() => {
    const g = globalThis as any;
    delete g.__VEAP_BOOTSTRAPPED__;
    delete g.__VEAP_BOOTSTRAPPING_PROMISE__;
    delete g.__VEAP_AUTH_CONTEXT__;
    container.clear();
  });

  it("provides default auth routes when withAuth is called without options", async () => {
    const app = Application.configure().withAuth().create();
    await app.bootstrap();

    const routes = getAuthRoutes();
    expect(routes).toEqual(DEFAULT_AUTH_ROUTES);
  });

  it("configures custom auth routes and registers rewrites in RouterService", async () => {
    const app = Application.configure()
      .withSettings()
      .withPlugins([])
      .withRouter()
      .withAuth({
        routes: {
          signIn: "/logowanie",
          signUp: "/rejestracja",
          forgotPassword: "/odzyskaj-haslo",
          afterLogin: "/dashboard",
          afterLogout: "/logowanie",
        },
      })
      .create();

    await app.bootstrap();

    const routes = getAuthRoutes();
    expect(routes.signIn).toBe("/logowanie");
    expect(routes.signUp).toBe("/rejestracja");
    expect(routes.forgotPassword).toBe("/odzyskaj-haslo");
    expect(routes.resetPassword).toBe("/reset-password"); // Default preserved
    expect(routes.afterLogin).toBe("/dashboard");
    expect(routes.afterLogout).toBe("/logowanie");

    const routerService = await container.resolve(RouterService);
    const rewrites = routerService.getRewrites();

    expect(rewrites.get("/logowanie")).toBe("/signin");
    expect(rewrites.get("/rejestracja")).toBe("/signup");
    expect(rewrites.get("/odzyskaj-haslo")).toBe("/forgot-password");
    expect(rewrites.has("/reset-password")).toBe(false); // Unmodified route not rewritten

    const tree = await routerService.buildRouteTree();
    expect(tree.resolveRewrite("/logowanie")).toBe("/signin");
    expect(tree.resolveRewrite("/rejestracja")).toBe("/signup");
  });
});
