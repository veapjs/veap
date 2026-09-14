import { addHours } from "date-fns";
import { sendVerifyEmail } from "../../communication/mail";
import { registerSecurityRequirement } from "../logic";
import { SessionService } from "./session.service";
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
  EMAIL_VERIFICATION_REPOSITORY,
  type EmailVerificationRecord,
  type IEmailVerificationRepository,
} from "../../../domain/auth/repositories/email-verification.repository";

export type EmailVerificationRequestType = EmailVerificationRecord;

@Injectable()
export class EmailVerificationService {
  constructor(
    @Inject(EMAIL_VERIFICATION_REPOSITORY)
    private readonly verifications: IEmailVerificationRepository,
    @Inject(TOKEN_GENERATOR) private readonly tokens: ITokenGenerator,
    @Inject(COOKIE_STORE) private readonly cookieStore: ICookieStore,
    private readonly sessions: SessionService,
  ) {}

  /**
   * Register Email Verification as a Core Security Requirement.
   */
  async initEmailVerification() {
    registerSecurityRequirement(async (_session, user) => {
      if (!user.emailVerifiedAt) {
        return {
          satisfied: false,
          redirect: "/verify-email?unverified",
        };
      }
      return { satisfied: true };
    });
  }

  /**
   * Retrieves a specific email verification request for a user.
   */
  async getUserEmailVerificationRequest(
    userId: string,
    id: string,
  ): Promise<EmailVerificationRequestType | null> {
    return await this.verifications.findForUser(userId, id);
  }

  /**
   * Creates a new email verification request, deleting any existing one for the user.
   */
  async createEmailVerificationRequest(
    userId: string,
    email: string,
  ): Promise<EmailVerificationRequestType> {
    await this.deleteUserEmailVerificationRequest(userId);

    return await this.verifications.create({
      userId,
      code: this.tokens.generateOtp(),
      email,
      expiresAt: new Date(addHours(new Date(), 1)),
    });
  }

  /**
   * Deletes all email verification requests for a user.
   */
  async deleteUserEmailVerificationRequest(userId: string): Promise<void> {
    await this.verifications.removeByUserId(userId);
  }

  /**
   * Sends a verification email with the OTP code.
   */
  async sendVerificationEmail(email: string, code: string): Promise<void> {
    await sendVerifyEmail(email, code);
  }

  /**
   * Sets the email verification request ID in a cookie.
   */
  async setEmailVerificationRequestCookie(
    request: EmailVerificationRequestType,
  ): Promise<void> {
    await this.cookieStore.set("email_verification", request.id, {
      httpOnly: true,
      path: "/",
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      expires: request.expiresAt,
    });
  }

  /**
   * Removes the email verification request cookie.
   */
  async deleteEmailVerificationRequestCookie(): Promise<void> {
    await this.cookieStore.delete("email_verification");
  }

  /**
   * Retrieves the current email verification request based on session and cookie.
   */
  async getUserEmailVerificationRequestFromRequest(): Promise<EmailVerificationRequestType | null> {
    const { user } = await this.sessions.getCurrentSession();

    if (!user) {
      return null;
    }

    const id = await this.cookieStore.get("email_verification");

    if (!id) {
      return null;
    }

    const request = await this.getUserEmailVerificationRequest(user.id, id);

    if (!request) {
      await this.deleteEmailVerificationRequestCookie();
    }

    return request;
  }
}
