import { AppError } from "../../../domain/errors/app-error";
import { Inject, Injectable } from "../../../domain/contracts/ioc";
import { eventBus } from "../../events/event-bus";
import { authValidators, performFullUserAugmentation } from "../logic";
import type {
  LoginInput,
  RegisterInput,
} from "../../../domain/auth/validation";
import { loginSchema, registerSchema } from "../../../domain/auth/validation";
import type { AuthResponse, SessionFlags } from "../../../domain/auth/types";
import {
  PASSWORD_HASHER,
  type IPasswordHasher,
} from "../../../domain/auth/ports/password-hasher";
import { UserService } from "./user.service";
import { SessionService } from "./session.service";
import { EmailVerificationService } from "./email-verification.service";

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private sessionService: SessionService,
    private emailVerificationService: EmailVerificationService,
    @Inject(PASSWORD_HASHER) private readonly hasher: IPasswordHasher,
  ) {}

  /**
   * Sign In Logic
   */
  public async signIn(data: LoginInput): Promise<AuthResponse> {
    const { email, password } = await loginSchema.parseAsync(data);
    const user = await this.userService.getUserFromEmail(email);
    if (!user) {
      return { status: "ERROR", message: "Invalid email or password" };
    }

    const passwordHash = await this.userService.getUserPasswordHash(user.id);
    if (!passwordHash || !(await this.hasher.verify(passwordHash, password))) {
      return { status: "ERROR", message: "Invalid email or password" };
    }

    // Interception Layer
    for (const validator of authValidators) {
      const interception = await validator(user.id);
      if (interception) return interception;
    }

    const sessionFlags: SessionFlags = {};
    const sessionToken = await this.sessionService.generateSessionToken();
    const session = await this.sessionService.createSession(
      sessionToken,
      user.id,
      sessionFlags,
    );
    await this.sessionService.setSessionTokenCookie(
      sessionToken,
      session.expiresAt,
    );

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
    const verificationRequest =
      await this.emailVerificationService.createEmailVerificationRequest(
        user.id,
        user.email,
      );

    await this.emailVerificationService.sendVerificationEmail(
      verificationRequest.email,
      verificationRequest.code,
    );
    await this.emailVerificationService.setEmailVerificationRequestCookie(
      verificationRequest,
    );

    const sessionFlags: SessionFlags = {};
    const sessionToken = await this.sessionService.generateSessionToken();
    const session = await this.sessionService.createSession(
      sessionToken,
      user.id,
      sessionFlags,
    );
    await this.sessionService.setSessionTokenCookie(
      sessionToken,
      session.expiresAt,
    );

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
    const session = await this.sessionService.createSession(
      sessionToken,
      userId,
      flags,
    );
    await this.sessionService.setSessionTokenCookie(
      sessionToken,
      session.expiresAt,
    );

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
