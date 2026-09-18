import { beforeEach, describe, expect, it } from "vitest";

import { SessionService } from "../../../src/application/auth/services/session.service";
import { bindAuthContext } from "../../../src/application/auth/context";
import type { AuthService } from "../../../src/application/auth/services/auth.service";
import type { EmailVerificationService } from "../../../src/application/auth/services/email-verification.service";
import type { PasswordResetService } from "../../../src/application/auth/services/password-reset.service";
import type { RbacService } from "../../../src/application/auth/services/rbac.service";
import type { UserService } from "../../../src/application/auth/services/user.service";
import type {
  CreateSessionRecord,
  ISessionRepository,
} from "../../../src/domain/auth/repositories/session.repository";
import type { ITokenGenerator } from "../../../src/domain/auth/ports/token-generator";
import type {
  CookieOptions,
  ICookieStore,
  IHttpRequestContext,
} from "../../../src/domain/contracts/http-transport";
import type { Session } from "../../../src/domain/auth/types";

/**
 * SessionService - the first tests for the auth services, possible because
 * every transport concern is now a domain port. All collaborators are
 * in-memory fakes: no Next.js, no database, no container.
 */

/** Deterministic token generator: `hashToken` is injective and reversible-ish. */
class FakeTokenGenerator implements ITokenGenerator {
  private next = 0;

  public generateOtp(length = 6): string {
    return "0".repeat(length);
  }

  public generateRecoveryCode(): string {
    return "RECOVERY-CODE";
  }

  public generateSessionToken(): string {
    return `raw-token-${this.next++}`;
  }

  public hashToken(token: string): string {
    return `hashed(${token})`;
  }
}

class InMemorySessionRepository implements ISessionRepository {
  public sessions = new Map<string, Session>();
  public users = new Map<string, Record<string, any>>();

  public async create(record: CreateSessionRecord): Promise<Session> {
    const session: Session = {
      id: record.id,
      userId: record.userId,
      expiresAt: record.expiresAt,
      metadata: record.metadata ?? {},
    };
    this.sessions.set(record.id, session);
    return { ...session };
  }

  public async findWithUser(id: string) {
    const session = this.sessions.get(id);
    if (!session) return null;
    const user = this.users.get(String(session.userId ?? session.user_id));
    if (!user) return null;
    return { session: { ...session }, user: { ...user } };
  }

  public async findById(id: string): Promise<Session | null> {
    const session = this.sessions.get(id);
    return session ? { ...session } : null;
  }

  public async findByUserId(userId: string): Promise<Session[]> {
    return Array.from(this.sessions.values())
      .filter((s) => String(s.userId ?? s.user_id) === userId)
      .map((s) => ({ ...s }));
  }

  public async updateMetadata(
    id: string,
    metadata: Record<string, any>,
  ): Promise<void> {
    const session = this.sessions.get(id);
    if (session) session.metadata = { ...metadata };
  }

  public async remove(id: string): Promise<void> {
    this.sessions.delete(id);
  }

  public async removeByUserId(userId: string): Promise<void> {
    for (const [id, s] of this.sessions) {
      if (String(s.userId ?? s.user_id) === userId) this.sessions.delete(id);
    }
  }

  public async removeOtherUserSessions(
    userId: string,
    currentSessionId: string,
  ): Promise<void> {
    for (const [id, s] of this.sessions) {
      if (String(s.userId ?? s.user_id) === userId && id !== currentSessionId) {
        this.sessions.delete(id);
      }
    }
  }
}

class InMemoryCookieStore implements ICookieStore {
  public entries = new Map<
    string,
    { value: string; options?: CookieOptions }
  >();

  public async get(name: string): Promise<string | null> {
    return this.entries.get(name)?.value ?? null;
  }

  public async set(
    name: string,
    value: string,
    options?: CookieOptions,
  ): Promise<void> {
    this.entries.set(name, { value, options });
  }

  public async delete(name: string): Promise<void> {
    this.entries.delete(name);
  }
}

class FakeRequestContext implements IHttpRequestContext {
  public headers = new Map<string, string>();
  public redirects: string[] = [];

  public async getHeader(name: string): Promise<string | null> {
    return this.headers.get(name) ?? null;
  }

  public redirect(url: string): never {
    // Mirror the real contract: a redirect is a thrown signal, never a return.
    this.redirects.push(url);
    throw new Error(`REDIRECT:${url}`);
  }
}

describe("SessionService", () => {
  let repo: InMemorySessionRepository;
  let tokens: FakeTokenGenerator;
  let cookies: InMemoryCookieStore;
  let requestContext: FakeRequestContext;
  let service: SessionService;

  const USER = {
    id: "user-1",
    email: "user@example.com",
    name: "Test User",
    password: "bcrypt-hash",
    recovery_code: "secret-code",
  };

  beforeEach(() => {
    repo = new InMemorySessionRepository();
    tokens = new FakeTokenGenerator();
    cookies = new InMemoryCookieStore();
    requestContext = new FakeRequestContext();
    service = new SessionService(repo, tokens, cookies, requestContext);

    repo.users.set(USER.id, { ...USER });

    // `validateSessionToken` augments users through the RBAC context; bind a
    // fake so the test runs without the composition root.
    bindAuthContext({
      user: {} as UserService,
      session: {} as never,
      rbac: {
        coreRbacAugmenter: async () => ({ roles: ["user"] }),
      } as unknown as RbacService,
      passwordReset: {} as PasswordResetService,
      emailVerification: {} as EmailVerificationService,
      auth: {} as AuthService,
    });
  });

  describe("getCurrentSession", () => {
    it("returns nulls when no session cookie is present", async () => {
      const result = await service.getCurrentSession();
      expect(result).toEqual({ session: null, user: null });
    });

    it("returns the session and augmented user for a valid token", async () => {
      await repo.create({
        id: tokens.hashToken("raw-0"),
        userId: USER.id,
        expiresAt: new Date(Date.now() + 60_000),
        metadata: { mfa: false },
      });
      await cookies.set("session", "raw-0");

      const { session, user } = await service.getCurrentSession();

      expect(session?.id).toBe("hashed(raw-0)");
      expect(user?.email).toBe(USER.email);
      // Augmentation merged RBAC data into the user.
      expect((user as any)?.roles).toEqual(["user"]);
    });

    it("returns nulls for an unknown token without touching the repo", async () => {
      await cookies.set("session", "nope");
      const result = await service.getCurrentSession();
      expect(result).toEqual({ session: null, user: null });
    });

    it("returns nulls and removes expired sessions", async () => {
      const id = tokens.hashToken("expired");
      await repo.create({
        id,
        userId: USER.id,
        expiresAt: new Date(Date.now() - 1000),
      });
      await cookies.set("session", "expired");

      const result = await service.getCurrentSession();

      expect(result).toEqual({ session: null, user: null });
      expect(repo.sessions.has(id)).toBe(false);
    });

    it("strips sensitive fields (password, recovery_code) from the user", async () => {
      await repo.create({
        id: tokens.hashToken("raw-1"),
        userId: USER.id,
        expiresAt: new Date(Date.now() + 60_000),
      });
      await cookies.set("session", "raw-1");

      const { user } = await service.getCurrentSession();

      expect(user).not.toHaveProperty("password");
      expect(user).not.toHaveProperty("recovery_code");
    });
  });

  describe("cookie helpers", () => {
    it("setSessionTokenCookie writes through to the cookie store", async () => {
      const expiresAt = new Date(Date.now() + 86_400_000);
      await service.setSessionTokenCookie("token-value", expiresAt);

      const stored = cookies.entries.get("session");
      expect(stored?.value).toBe("token-value");
      expect(stored?.options?.httpOnly).toBe(true);
      expect(stored?.options?.expires).toBe(expiresAt);
    });

    it("deleteSessionTokenCookie removes the cookie", async () => {
      await cookies.set("session", "token");
      await service.deleteSessionTokenCookie();
      expect(cookies.entries.has("session")).toBe(false);
    });
  });

  describe("createSession", () => {
    it("persists the session under the hashed token with a 7-day expiry", async () => {
      const session = await service.createSession("raw-2", USER.id, {
        mfa: true,
      });

      expect(session.id).toBe("hashed(raw-2)");
      expect(repo.sessions.get(session.id)?.userId).toBe(USER.id);
      expect(repo.sessions.get(session.id)?.metadata).toEqual({ mfa: true });

      const expectedExpiry = Date.now() + 7 * 86_400_000;
      const actualExpiry = (
        repo.sessions.get(session.id)?.expiresAt as Date
      ).getTime();
      expect(Math.abs(actualExpiry - expectedExpiry)).toBeLessThan(60_000);
    });
  });

  describe("sessionSignOut", () => {
    it("invalidates the session, clears the cookie and redirects to /signin", async () => {
      const id = tokens.hashToken("raw-3");
      await repo.create({
        id,
        userId: USER.id,
        expiresAt: new Date(Date.now() + 60_000),
      });
      await cookies.set("session", "raw-3");

      await expect(service.sessionSignOut()).rejects.toThrow(
        "REDIRECT:/signin",
      );

      expect(repo.sessions.has(id)).toBe(false);
      expect(cookies.entries.has("session")).toBe(false);
      expect(requestContext.redirects).toEqual(["/signin"]);
    });

    it("still redirects when there is no active session", async () => {
      await expect(service.sessionSignOut()).rejects.toThrow(
        "REDIRECT:/signin",
      );
      expect(requestContext.redirects).toEqual(["/signin"]);
    });
  });

  describe("metadata and listing", () => {
    it("updateSessionMetadata merges flags into the current session", async () => {
      const id = tokens.hashToken("raw-4");
      await repo.create({
        id,
        userId: USER.id,
        expiresAt: new Date(Date.now() + 60_000),
        metadata: { mfa: false },
      });
      await cookies.set("session", "raw-4");

      await service.updateSessionMetadata({ mfa: true, passkey: true });

      expect(repo.sessions.get(id)?.metadata).toEqual({
        mfa: true,
        passkey: true,
      });
    });

    it("updateSessionMetadata is a no-op without a session", async () => {
      await expect(
        service.updateSessionMetadata({ mfa: true }),
      ).resolves.toBeUndefined();
    });

    it("getUserSessions flags the current one", async () => {
      await repo.create({
        id: "sess-a",
        userId: USER.id,
        expiresAt: new Date(Date.now() + 60_000),
      });
      await repo.create({
        id: "sess-b",
        userId: USER.id,
        expiresAt: new Date(Date.now() + 60_000),
      });

      const sessions = await service.getUserSessions(USER.id, "sess-b");

      expect(sessions).toHaveLength(2);
      const byId = new Map(sessions.map((s) => [s.id, s]));
      expect(byId.get("sess-a")?.isCurrent).toBe(false);
      expect(byId.get("sess-b")?.isCurrent).toBe(true);
    });

    it("invalidateOtherSessions keeps only the current session", async () => {
      await repo.create({
        id: "keep",
        userId: USER.id,
        expiresAt: new Date(Date.now() + 60_000),
      });
      await repo.create({
        id: "drop",
        userId: USER.id,
        expiresAt: new Date(Date.now() + 60_000),
      });

      await service.invalidateOtherSessions(USER.id, "keep");

      expect(repo.sessions.has("keep")).toBe(true);
      expect(repo.sessions.has("drop")).toBe(false);
    });
  });

  describe("getIPAddress", () => {
    it("reads the forwarded-for header through the request context", async () => {
      requestContext.headers.set("x-forwarded-for", "203.0.113.9");
      await expect(service.getIPAddress()).resolves.toBe("203.0.113.9");
    });

    it("returns null when the header is absent", async () => {
      await expect(service.getIPAddress()).resolves.toBeNull();
    });
  });
});
