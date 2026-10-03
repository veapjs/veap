import { type IPasswordHasher, PASSWORD_HASHER } from "../../../domain/auth/ports/password-hasher";
import type { AuthResponse, SessionFlags } from "../../../domain/auth/types";
import type { LoginInput, RegisterInput } from "../../../domain/auth/validation";
import { loginSchema, registerSchema } from "../../../domain/auth/validation";
import { CACHE_PROVIDER, type ICacheProvider } from "../../../domain/contracts/cache";
import { Inject, Injectable } from "../../../domain/contracts/ioc";
import { AppError } from "../../../domain/errors/app-error";
import { eventBus } from "../../events/event-bus";
import { authValidators, performFullUserAugmentation } from "../logic";
import { EmailVerificationService } from "./email-verification.service";
import { SessionService } from "./session.service";
import { UserService } from "./user.service";

@Injectable()
export class AuthService {
  private failedAttempts = new Map<string, { count: number; expiresAt: number }>();

  constructor(
    private userService: UserService,
    private sessionService: SessionService,
    private emailVerificationService: EmailVerificationService,
    @Inject(PASSWORD_HASHER) private readonly hasher: IPasswordHasher,
    @Inject(CACHE_PROVIDER) private readonly cache?: ICacheProvider,
  ) {}

  private async isRateLimited(key: string): Promise<boolean> {
    if (this.cache) {
      const attempts = await this.cache.get<number>(`rl:${key}`);
      return (attempts ?? 0) >= 5;
    }
    const record = this.failedAttempts.get(key);
    if (!record) return false;
    if (Date.now() > record.expiresAt) {
      this.failedAttempts.delete(key);
      return false;
    }
    return record.count >= 5;
  }

  private async recordFailedAttempt(key: string): Promise<void> {
    if (this.cache) {
      const current = ((await this.cache.get<number>(`rl:${key}`)) ?? 0) + 1;
      await this.cache.set(`rl:${key}`, current, 15 * 60);
      return;
    }
    const record = this.failedAttempts.get(key);
    if (!record || Date.now() > record.expiresAt) {
      this.failedAttempts.set(key, {
        count: 1,
        expiresAt: Date.now() + 15 * 60 * 1000,
      });
    } else {
      record.count += 1;
    }
  }

  private async clearFailedAttempts(key: string): Promise<void> {
    if (this.cache) {
      await this.cache.delete(`rl:${key}`);
      return;
    }
    this.failedAttempts.delete(key);
  }

  /**
   * Sign In Logic
   */
  public async signIn(data: LoginInput): Promise<AuthResponse> {
    const { email, password } = await loginSchema.parseAsync(data);
    const normalizedEmail = email.toLowerCase().trim();

    // Check rate limits for email and IP
    const ip = await this.sessionService.getIPAddress();
    const isEmailBlocked = await this.isRateLimited(`login:email:${normalizedEmail}`);
    const isIpBlocked = ip ? await this.isRateLimited(`login:ip:${ip}`) : false;

    if (isEmailBlocked || isIpBlocked) {
      return {
        status: "ERROR",
        message: "Too many failed login attempts. Please try again in 15 minutes.",
      };
    }

    const user = await this.userService.getUserFromEmail(normalizedEmail);
    if (!user) {
      // Prevent timing attacks by running a dummy hash verification
      await this.hasher.verify(
        "$2b$10$abcdefghijklmnopqrstuuabcdefghijklmnopqrstuuabcdefghijk",
        password,
      );
      await this.recordFailedAttempt(`login:email:${normalizedEmail}`);
      if (ip) await this.recordFailedAttempt(`login:ip:${ip}`);
      return { status: "ERROR", message: "Invalid email or password" };
    }

    const passwordHash = await this.userService.getUserPasswordHash(user.id);
    if (!passwordHash || !(await this.hasher.verify(passwordHash, password))) {
      await this.recordFailedAttempt(`login:email:${normalizedEmail}`);
      if (ip) await this.recordFailedAttempt(`login:ip:${ip}`);
      return { status: "ERROR", message: "Invalid email or password" };
    }

    // Login succeeded - clear failed attempts
    await this.clearFailedAttempts(`login:email:${normalizedEmail}`);
    if (ip) await this.clearFailedAttempts(`login:ip:${ip}`);

    // Interception Layer
    for (const validator of authValidators) {
      const interception = await validator(user.id);
      if (interception) return interception;
    }

    const sessionFlags: SessionFlags = {};
    const sessionToken = await this.sessionService.generateSessionToken();
    const session = await this.sessionService.createSession(sessionToken, user.id, sessionFlags);
    await this.sessionService.setSessionTokenCookie(sessionToken, session.expiresAt);

    const fullUser = await performFullUserAugmentation(user);

    await eventBus.publish("system:auth:login", {
      session,
      user: fullUser,
    });

    await eventBus.publish("system:auth:session-created", {
      session,
      user: fullUser,
    });

    return {
      status: "SUCCESS",
      session: { ...session },
      user: { ...fullUser },
    };
  }

  /**
   * Sign Up Logic
   */
  public async signUp(data: RegisterInput) {
    const { email, username, password } = registerSchema.parse(data);

    if (!(await this.userService.verifyUsernameInput(username))) {
      throw AppError.BadRequest("Invalid username");
    }

    if (!(await this.hasher.validateStrength(password))) {
      throw AppError.BadRequest("Weak password");
    }

    const user = await this.userService.createUser(email, username, password);
    const verificationRequest = await this.emailVerificationService.createEmailVerificationRequest(
      user.id,
      user.email,
    );

    await this.emailVerificationService.sendVerificationEmail(
      verificationRequest.email,
      verificationRequest.code,
    );
    await this.emailVerificationService.setEmailVerificationRequestCookie(verificationRequest);

    const sessionFlags: SessionFlags = {};
    const sessionToken = await this.sessionService.generateSessionToken();
    const session = await this.sessionService.createSession(sessionToken, user.id, sessionFlags);
    await this.sessionService.setSessionTokenCookie(sessionToken, session.expiresAt);

    const fullUser = await performFullUserAugmentation(user);
    await eventBus.publish("system:auth:signup", {
      session,
      user: fullUser,
    });

    await eventBus.publish("system:auth:session-created", {
      session,
      user: fullUser,
    });

    return {
      session: { ...session },
      user: { ...fullUser },
    };
  }

  /**
   * Finalizes login after a challenge
   */
  public async finalizeLogin(userId: string, flags: SessionFlags) {
    const sessionToken = await this.sessionService.generateSessionToken();
    const session = await this.sessionService.createSession(sessionToken, userId, flags);
    await this.sessionService.setSessionTokenCookie(sessionToken, session.expiresAt);

    const user = await this.userService.getUserById(userId);

    if (user) {
      const fullUser = await performFullUserAugmentation(user);
      await eventBus.publish("system:auth:session-created", {
        session,
        user: fullUser,
      });
      return {
        session: session ? { ...session } : null,
        user: fullUser ? { ...fullUser } : null,
      };
    }

    return {
      session: session ? { ...session } : null,
      user: null,
    };
  }

  /**
   * Sign Out
   */
  public async signOut() {
    const { session, user } = await this.sessionService.getCurrentSession();
    if (session) {
      if (user) {
        await eventBus.publish("system:auth:signed-out", {
          user,
        });
      }
      await this.sessionService.invalidateSession(session.id);
      await this.sessionService.deleteSessionTokenCookie();
    }
  }
}
