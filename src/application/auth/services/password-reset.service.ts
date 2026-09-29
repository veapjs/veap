import { addMinutes } from "date-fns";
import { sendResetPassword } from "../../communication/mail";
import { augmentPasswordResetSession } from "../augment";
import { performFullUserAugmentation } from "../logic";
import type {
  PasswordResetAuthSession,
  PasswordResetSession as PasswordResetSessionType,
} from "../../../domain/auth/types";
import {
  TOKEN_GENERATOR,
  type ITokenGenerator,
} from "../../../domain/auth/ports/token-generator";
import { Inject, Injectable } from "../../../domain/contracts/ioc";
import {
  COOKIE_STORE,
  type ICookieStore,
} from "../../../domain/contracts/http-transport";
import {
  PASSWORD_RESET_REPOSITORY,
  type IPasswordResetRepository,
} from "../../../domain/auth/repositories/password-reset.repository";
import {
  CACHE_PROVIDER,
  type ICacheProvider,
} from "../../../domain/contracts/cache";

interface DummyResetSession {
  id: string;
  email: string;
  expiresAt: Date;
  attempts: number;
}

const dummySessions = new Map<string, DummyResetSession>();

@Injectable()
export class PasswordResetService {
  private inMemoryAttempts = new Map<
    string,
    { count: number; expiresAt: number }
  >();

  constructor(
    @Inject(PASSWORD_RESET_REPOSITORY)
    private readonly sessions: IPasswordResetRepository,
    @Inject(TOKEN_GENERATOR) private readonly tokens: ITokenGenerator,
    @Inject(COOKIE_STORE) private readonly cookieStore: ICookieStore,
    @Inject(CACHE_PROVIDER) private readonly cache?: ICacheProvider,
  ) {}

  async createPasswordResetSession(
    token: string,
    userId: string,
    email: string,
  ): Promise<PasswordResetSessionType> {
    const sessionId = this.tokens.hashToken(token);

    return await this.sessions.create({
      id: sessionId,
      email,
      code: this.tokens.generateOtp(),
      expiresAt: new Date(addMinutes(new Date(), 15)),
      userId,
    });
  }

  /**
   * Creates an ephemeral dummy reset session for an unregistered email.
   * This prevents user enumeration while providing an identical UX.
   */
  async createDummyPasswordResetSession(
    token: string,
    email: string,
  ): Promise<PasswordResetSessionType> {
    const sessionId = this.tokens.hashToken(token);
    const expiresAt = new Date(addMinutes(new Date(), 15));
    const session: PasswordResetSessionType = {
      id: sessionId,
      email,
      code: "------",
      expiresAt,
      userId: "dummy",
    };

    dummySessions.set(sessionId, {
      id: sessionId,
      email,
      expiresAt,
      attempts: 0,
    });

    return session;
  }

  async validatePasswordResetSessionToken(
    token: string,
  ): Promise<PasswordResetAuthSession> {
    const sessionId = this.tokens.hashToken(token);

    const record = await this.sessions.findWithUser(sessionId);
    if (!record) {
      // Check for dummy session to prevent timing and existence leakage
      const dummy = dummySessions.get(sessionId);
      if (dummy && new Date() <= new Date(dummy.expiresAt)) {
        return {
          session: {
            id: dummy.id,
            email: dummy.email,
            code: "------",
            expiresAt: dummy.expiresAt,
            userId: "dummy",
          },
          user: {
            id: "dummy",
            email: dummy.email,
            name: "User",
            roles: [],
            permissions: [],
            emailVerifiedAt: null,
            createdAt: new Date(),
            updatedAt: null,
            recovery_code: null,
            image: null,
            password: null,
          } as any,
        };
      }
      return { session: null, user: null };
    }

    const baseSession = record.session;
    const baseUser = record.user;

    if (new Date() > new Date(baseSession.expiresAt)) {
      await this.sessions.remove(sessionId);
      return { session: null, user: null };
    }

    const { password, recovery_code, ...safeUser } = baseUser;

    const user = await performFullUserAugmentation(safeUser as any);
    const session = await augmentPasswordResetSession(
      baseSession as PasswordResetSessionType,
    );

    return { session, user };
  }

  /**
   * Verifies the OTP code for a password reset session.
   * Enforces a maximum of 5 failed attempts before terminating the session.
   */
  async verifyResetCode(
    sessionId: string,
    code: string,
  ): Promise<{ valid: boolean; error?: string }> {
    // Handle dummy session
    const dummy = dummySessions.get(sessionId);
    if (dummy) {
      dummy.attempts += 1;
      if (dummy.attempts >= 5 || new Date() > new Date(dummy.expiresAt)) {
        dummySessions.delete(sessionId);
        await this.deletePasswordResetSessionTokenCookie();
        return {
          valid: false,
          error:
            "Too many failed attempts. Password reset request has been cancelled.",
        };
      }
      return { valid: false, error: "Incorrect code" };
    }

    const record = await this.sessions.findWithUser(sessionId);
    if (!record) {
      return { valid: false, error: "Invalid or expired session" };
    }

    if (new Date() > new Date(record.session.expiresAt)) {
      await this.sessions.remove(sessionId);
      await this.deletePasswordResetSessionTokenCookie();
      return { valid: false, error: "Password reset code has expired" };
    }

    // Check attempts limit
    const attemptKey = `pw_reset_attempts:${sessionId}`;
    let attempts = 0;
    if (this.cache) {
      attempts = ((await this.cache.get<number>(attemptKey)) || 0) + 1;
      await this.cache.set(attemptKey, attempts, 15 * 60);
    } else {
      const rec = this.inMemoryAttempts.get(sessionId);
      attempts = (rec && Date.now() <= rec.expiresAt ? rec.count : 0) + 1;
      this.inMemoryAttempts.set(sessionId, {
        count: attempts,
        expiresAt: Date.now() + 15 * 60 * 1000,
      });
    }

    if (attempts >= 5) {
      await this.sessions.remove(sessionId);
      await this.deletePasswordResetSessionTokenCookie();
      if (this.cache) await this.cache.delete(attemptKey);
      this.inMemoryAttempts.delete(sessionId);
      return {
        valid: false,
        error:
          "Too many failed attempts. Password reset request has been cancelled.",
      };
    }

    if (record.session.code !== code) {
      return { valid: false, error: "Incorrect code" };
    }

    if (this.cache) await this.cache.delete(attemptKey);
    this.inMemoryAttempts.delete(sessionId);
    await this.sessions.setEmailVerified(sessionId);
    return { valid: true };
  }

  async setPasswordResetSessionAsEmailVerified(
    sessionId: string,
  ): Promise<void> {
    await this.sessions.setEmailVerified(sessionId);
  }

  async invalidateUserPasswordResetSessions(userId: string): Promise<void> {
    await this.sessions.removeByUserId(userId);
  }

  async getCurrentPasswordResetSession(): Promise<PasswordResetAuthSession> {
    const token = await this.cookieStore.get("password_reset_session");

    if (token === null) {
      return { session: null, user: null };
    }

    const result = await this.validatePasswordResetSessionToken(token);

    if (result.session === null) {
      await this.deletePasswordResetSessionTokenCookie();
    }

    return result;
  }

  async setPasswordResetSessionTokenCookie(
    token: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.cookieStore.set("password_reset_session", token, {
      expires: expiresAt,
      sameSite: "lax",
      httpOnly: true,
      path: "/",
      secure: process.env.NODE_ENV === "production",
    });
  }

  async deletePasswordResetSessionTokenCookie(): Promise<void> {
    await this.cookieStore.delete("password_reset_session");
  }

  async sendPasswordResetEmail(email: string, code: string): Promise<void> {
    await sendResetPassword(email, code);
  }
}
