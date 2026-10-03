import { describe, expect, it } from "vitest";
import { verifySameOrigin } from "../../../src/infrastructure/http/next-request-context";

describe("verifySameOrigin CSRF protection", () => {
  it("allows safe HTTP methods (GET, HEAD, OPTIONS) unconditionally", () => {
    const getReq = new Request("http://localhost:3000/api/test", {
      method: "GET",
      headers: { "sec-fetch-site": "cross-site" },
    });
    expect(verifySameOrigin(getReq)).toBe(true);

    const headReq = new Request("http://localhost:3000/api/test", {
      method: "HEAD",
    });
    expect(verifySameOrigin(headReq)).toBe(true);
  });

  it("blocks state-changing requests when Sec-Fetch-Site is cross-site", () => {
    const postReq = new Request("http://localhost:3000/api/mutation", {
      method: "POST",
      headers: {
        "sec-fetch-site": "cross-site",
        origin: "http://attacker.com",
        host: "localhost:3000",
      },
    });
    expect(verifySameOrigin(postReq)).toBe(false);
  });

  it("blocks state-changing requests when Origin host does not match Host header", () => {
    const postReq = new Request("http://example.com/api/mutation", {
      method: "POST",
      headers: {
        origin: "http://evil.com",
        host: "example.com",
      },
    });
    expect(verifySameOrigin(postReq)).toBe(false);
  });

  it("allows state-changing requests when Origin host matches Host header", () => {
    const postReq = new Request("http://example.com/api/mutation", {
      method: "POST",
      headers: {
        origin: "http://example.com",
        host: "example.com",
      },
    });
    expect(verifySameOrigin(postReq)).toBe(true);
  });
});
