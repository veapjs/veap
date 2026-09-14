import { addHours } from "date-fns";
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

@Injectable()
export class PasswordResetService {
  constructor(
    @Inject(PASSWORD_RESET_REPOSITORY)
    private readonly sessions: IPasswordResetRepository,
    @Inject(TOKEN_GENERATOR) private readonly tokens: ITokenGenerator,
    @Inject(COOKIE_STORE) private readonly cookieStore: ICookieStore,
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
      expiresAt: new Date(addHours(new Date(), 1)),
      userId,
    });
  }

  async validatePasswordResetSessionToken(
    token: string,
  ): Promise<PasswordResetAuthSession> {
    const sessionId = this.tokens.hashToken(token);

    const record = await this.sessions.findWithUser(sessionId);
    if (!record) {
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
