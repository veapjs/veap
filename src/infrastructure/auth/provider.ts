import { bindAuthContext } from "../../application/auth/context";
import { AuthService } from "../../application/auth/services/auth.service";
import { EmailVerificationService } from "../../application/auth/services/email-verification.service";
import { PasswordResetService } from "../../application/auth/services/password-reset.service";
import { RbacService } from "../../application/auth/services/rbac.service";
import { SessionService } from "../../application/auth/services/session.service";
import { UserService } from "../../application/auth/services/user.service";
import { RouterService } from "../../application/router/router.service";
import { PASSWORD_HASHER, SECRET_CIPHER, TOKEN_GENERATOR } from "../../domain/auth/ports";
import { EMAIL_VERIFICATION_REPOSITORY } from "../../domain/auth/repositories/email-verification.repository";
import { PASSWORD_RESET_REPOSITORY } from "../../domain/auth/repositories/password-reset.repository";
import { PERMISSION_REPOSITORY } from "../../domain/auth/repositories/permission.repository";
import { ROLE_REPOSITORY } from "../../domain/auth/repositories/role.repository";
import { SESSION_REPOSITORY } from "../../domain/auth/repositories/session.repository";
import { USER_REPOSITORY } from "../../domain/auth/repositories/user.repository";
import {
  type AuthConfig,
  type AuthRoutesConfig,
  DEFAULT_AUTH_ROUTES,
} from "../../domain/auth/types";
import { AUTH_ROUTES } from "../../domain/contracts/token";
import { ServiceProvider } from "../../infrastructure/providers/service-provider";
import { ConfigService } from "../config/config.service";
import type { Container } from "../ioc/container";
import { AesSecretCipher } from "./adapters/aes-secret-cipher";
import { BcryptPasswordHasher } from "./adapters/bcrypt-password-hasher";
import { OsloTokenGenerator } from "./adapters/oslo-token-generator";
import { ActiveRecordEmailVerificationRepository } from "./repositories/active-record-email-verification.repository";
import { ActiveRecordPasswordResetRepository } from "./repositories/active-record-password-reset.repository";
import { ActiveRecordPermissionRepository } from "./repositories/active-record-permission.repository";
import { ActiveRecordRoleRepository } from "./repositories/active-record-role.repository";
import { ActiveRecordSessionRepository } from "./repositories/active-record-session.repository";
import { ActiveRecordUserRepository } from "./repositories/active-record-user.repository";
import { isSystemInstalled } from "./setup";

export class AuthServiceProvider extends ServiceProvider {
  private config?: AuthConfig;

  constructor(container: Container, config?: AuthConfig) {
    super(container);
    this.config = config;
  }

  private resolveRoutes(): AuthRoutesConfig {
    return {
      ...DEFAULT_AUTH_ROUTES,
      ...this.config?.routes,
    };
  }

  register(): void {
    const routes = this.resolveRoutes();
    this.container.register({
      token: AUTH_ROUTES,
      useValue: routes,
    });

    // Cryptographic ports → concrete adapters
    this.container.register({
      token: PASSWORD_HASHER,
      useFactory: (config: ConfigService) => {
        const roundsRaw = config.get("AUTH_BCRYPT_ROUNDS");
        const minLengthRaw = config.get("AUTH_PASSWORD_MIN_LENGTH");
        const rounds = roundsRaw ? parseInt(roundsRaw, 10) : undefined;
        const minLength = minLengthRaw ? parseInt(minLengthRaw, 10) : undefined;
        return new BcryptPasswordHasher(rounds, minLength);
      },
      inject: [ConfigService],
      singleton: true,
    });

    this.container.register({
      token: TOKEN_GENERATOR,
      useClass: OsloTokenGenerator,
      singleton: true,
    });

    this.container.register({
      token: SECRET_CIPHER,
      useClass: AesSecretCipher,
      singleton: true,
    });

    // Persistence ports → ActiveRecord adapters
    this.container.register({
      token: USER_REPOSITORY,
      useClass: ActiveRecordUserRepository,
      singleton: true,
    });

    this.container.register({
      token: ROLE_REPOSITORY,
      useClass: ActiveRecordRoleRepository,
      singleton: true,
    });

    this.container.register({
      token: PERMISSION_REPOSITORY,
      useClass: ActiveRecordPermissionRepository,
      singleton: true,
    });

    this.container.register({
      token: SESSION_REPOSITORY,
      useClass: ActiveRecordSessionRepository,
      singleton: true,
    });

    this.container.register({
      token: PASSWORD_RESET_REPOSITORY,
      useClass: ActiveRecordPasswordResetRepository,
      singleton: true,
    });

    this.container.register({
      token: EMAIL_VERIFICATION_REPOSITORY,
      useClass: ActiveRecordEmailVerificationRepository,
      singleton: true,
    });

    // Application services
    this.container.register({
      token: EmailVerificationService,
      useClass: EmailVerificationService,
      singleton: true,
    });

    this.container.register({
      token: UserService,
      useClass: UserService,
      singleton: true,
    });

    this.container.register({
      token: SessionService,
      useClass: SessionService,
      singleton: true,
    });

    this.container.register({
      token: AuthService,
      useClass: AuthService,
      singleton: true,
    });

    this.container.register({
      token: PasswordResetService,
      useClass: PasswordResetService,
      singleton: true,
    });

    this.container.register({
      token: RbacService,
      useClass: RbacService,
      singleton: true,
    });
  }

  async boot(): Promise<void> {
    const routes = this.resolveRoutes();

    // Bind the auth context once so facades and `logic` helpers never resolve
    // services through the container themselves.
    bindAuthContext({
      user: await this.container.resolve(UserService),
      session: await this.container.resolve(SessionService),
      rbac: await this.container.resolve(RbacService),
      passwordReset: await this.container.resolve(PasswordResetService),
      emailVerification: await this.container.resolve(EmailVerificationService),
      auth: await this.container.resolve(AuthService),
      routes,
    });

    // Automatically register router rewrites if custom routes differ from default virtual paths
    if (this.container.has(RouterService)) {
      const routerService = await this.container.resolve<RouterService>(RouterService);
      if (routes.signIn !== DEFAULT_AUTH_ROUTES.signIn) {
        routerService.addRewrite(routes.signIn, DEFAULT_AUTH_ROUTES.signIn);
      }
      if (routes.signUp !== DEFAULT_AUTH_ROUTES.signUp) {
        routerService.addRewrite(routes.signUp, DEFAULT_AUTH_ROUTES.signUp);
      }
      if (routes.forgotPassword !== DEFAULT_AUTH_ROUTES.forgotPassword) {
        routerService.addRewrite(routes.forgotPassword, DEFAULT_AUTH_ROUTES.forgotPassword);
      }
      if (routes.resetPassword !== DEFAULT_AUTH_ROUTES.resetPassword) {
        routerService.addRewrite(routes.resetPassword, DEFAULT_AUTH_ROUTES.resetPassword);
      }
      if (routes.verifyEmail !== DEFAULT_AUTH_ROUTES.verifyEmail) {
        routerService.addRewrite(routes.verifyEmail, DEFAULT_AUTH_ROUTES.verifyEmail);
      }
    }

    if (await isSystemInstalled()) {
      const emailService = await this.container.resolve(EmailVerificationService);
      await emailService.initEmailVerification();
    }
  }
}
