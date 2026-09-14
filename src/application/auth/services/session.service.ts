import { Inject, Injectable } from "../../../domain/contracts/ioc";
import {
  COOKIE_STORE,
  type ICookieStore,
  REQUEST_CONTEXT,
  type IHttpRequestContext,
} from "../../../domain/contracts/http-transport";
import {
  TOKEN_GENERATOR,
  type ITokenGenerator,
} from "../../../domain/auth/ports/token-generator";
import { addDays } from "date-fns";
import {
  SESSION_REPOSITORY,
  type ISessionRepository,
} from "../../../domain/auth/repositories/session.repository";
import type {
  AuthSession,
  Session as SessionType,
  SessionFlags,
  User,
  UserSession,
} from "../../../domain/auth/types";
import { augmentSession } from "../augment";
import { performFullUserAugmentation } from "../logic";

@Injectable()
export class SessionService {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: ISessionRepository,
    @Inject(TOKEN_GENERATOR) private readonly tokens: ITokenGenerator,
    @Inject(COOKIE_STORE) private readonly cookieStore: ICookieStore,
    @Inject(REQUEST_CONTEXT)
    private readonly requestContext: IHttpRequestContext,
  ) {}

  /**
   * Returns the user's IP address.
   */
  public async getIPAddress(): Promise<string | null> {
    return this.requestContext.getHeader("x-forwarded-for");
  }

  /**
   * Validates the session token.
   */
  public async validateSessionToken(token: string): Promise<AuthSession> {
    const sessionId = this.tokens.hashToken(token);

    const record = await this.sessions.findWithUser(sessionId);
    if (!record) {
      return { session: null, user: null };
    }

    const baseUserAttributes = record.user;
    const baseSessionAttributes = record.session;

    // STRICTLY remove non-serializable and sensitive fields (including camelCase recoveryCode)
    const { password, recovery_code, recoveryCode, ...safeUserRest } =
      baseUserAttributes;
    const safeUser = {
      ...safeUserRest,
      id: baseUserAttributes.id || safeUserRest.id,
    };

    const expiresAt =
      baseSessionAttributes.expiresAt ?? baseSessionAttributes.expires_at;

    // Check if session is expired
    if (new Date() > new Date(expiresAt as any)) {
      await this.sessions.remove(sessionId);
      return { session: null, user: null };
    }

    const metadata = baseSessionAttributes.metadata || {};

    // Restore metadata into session object
    const sessionWithFlags = {
      ...baseSessionAttributes,
      id: baseSessionAttributes.id,
      userId: baseSessionAttributes.userId ?? baseSessionAttributes.user_id,
      expiresAt,
      metadata,
      ...(metadata as Record<string, any>),
    };

    // AUGMENT (EXTENSIBILITY POINTS)
    const augmentedUser = await performFullUserAugmentation(
      safeUser as User,
      sessionWithFlags as SessionType,
    );
    const augmentedSession = await augmentSession(
      sessionWithFlags as SessionType,
    );

    // ENSURE PLAIN OBJECTS for Client Components
    return {
      session: augmentedSession ? { ...augmentedSession } : null,
      user: augmentedUser ? { ...augmentedUser } : null,
    };
  }

  /**
   * Returns the current user session from cookies.
   */
  public async getCurrentSession(): Promise<AuthSession> {
    const token = await this.cookieStore.get("session");

    if (token === null) {
      return { session: null, user: null };
    }

    return await this.validateSessionToken(token);
  }

  /**
   * Invalidates a single session.
   */
  public async invalidateSession(sessionId: string): Promise<void> {
    await this.sessions.remove(sessionId);
  }

  /**
   * Invalidates all user sessions.
   */
  public async invalidateUserSessions(userId: string): Promise<void> {
    await this.sessions.removeByUserId(userId);
  }

  /**
   * Sets the session token in a cookie.
   */
  public async setSessionTokenCookie(
    token: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.cookieStore.set("session", token, {
      httpOnly: true,
      path: "/",
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      expires: expiresAt,
    });
  }

  /**
   * Removes the session token cookie.
   */
  public async deleteSessionTokenCookie(): Promise<void> {
    await this.cookieStore.delete("session");
  }

  /**
   * Generates a new random session token.
   */
  public async generateSessionToken(): Promise<string> {
    return this.tokens.generateSessionToken();
  }

  /**
   * Creates a new session in the database.
   */
  public async createSession(
    token: string,
    userId: string,
    flags: SessionFlags,
  ): Promise<SessionType> {
    const sessionId = this.tokens.hashToken(token);

    return await this.sessions.create({
      id: sessionId,
      expiresAt: new Date(addDays(new Date(), 7)),
      userId,
      metadata: flags,
    });
  }

  /**
   * Updates the current session metadata.
   */
  public async updateSessionMetadata(flags: SessionFlags): Promise<void> {
    const { session } = await this.getCurrentSession();
    if (!session) return;

    const current = await this.sessions.findById(session.id);
    if (!current) return;

    const newMetadata = {
      ...(current.metadata || {}),
      ...flags,
    };

    await this.sessions.updateMetadata(session.id, newMetadata);
  }

  /**
   * Signs the user out and redirects to the sign-in page.
   */
  public async sessionSignOut(): Promise<void> {
    const { session } = await this.getCurrentSession();

    if (session) {
      await this.invalidateSession(session.id);
      await this.deleteSessionTokenCookie();
    }

    await this.requestContext.redirect("/signin");
  }

  /**
   * Get all active sessions for a user.
   */
  public async getUserSessions(
    userId: string,
    currentSessionId: string,
  ): Promise<UserSession[]> {
    const sessions = await this.sessions.findByUserId(userId);

    const augmentedSessions = await Promise.all(
      sessions.map(async (session) => {
        const metadata = session.metadata || {};
        const sessionWithFlags = {
          ...session,
          id: session.id,
          userId: session.userId ?? session.user_id,
          expiresAt: session.expiresAt ?? session.expires_at,
          metadata,
          ...(metadata as Record<string, any>),
        };

        // Run augmenters
        const augmented = await augmentSession(sessionWithFlags as SessionType);

        return {
          ...augmented,
          isCurrent: augmented.id === currentSessionId,
        } as UserSession;
      }),
    );

    return augmentedSessions;
  }

  /**
   * Invalidate all sessions for a user except the specified current one.
   */
  public async invalidateOtherSessions(
    userId: string,
    currentSessionId: string,
  ): Promise<void> {
    await this.sessions.removeOtherUserSessions(userId, currentSessionId);
  }
}
