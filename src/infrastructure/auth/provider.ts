import { ServiceProvider } from "../../infrastructure/providers/service-provider";
import { isSystemInstalled } from "./setup";
import { bindAuthContext } from "../../application/auth/context";
import { EmailVerificationService } from "../../application/auth/services/email-verification.service";
import { PasswordResetService } from "../../application/auth/services/password-reset.service";
import { RbacService } from "../../application/auth/services/rbac.service";
import { AuthService } from "../../application/auth/services/auth.service";
import { UserService } from "../../application/auth/services/user.service";
import { SessionService } from "../../application/auth/services/session.service";

import { USER_REPOSITORY } from "../../domain/auth/repositories/user.repository";
import { ROLE_REPOSITORY } from "../../domain/auth/repositories/role.repository";
import { PERMISSION_REPOSITORY } from "../../domain/auth/repositories/permission.repository";
import { SESSION_REPOSITORY } from "../../domain/auth/repositories/session.repository";
import { PASSWORD_RESET_REPOSITORY } from "../../domain/auth/repositories/password-reset.repository";
import { EMAIL_VERIFICATION_REPOSITORY } from "../../domain/auth/repositories/email-verification.repository";

import { ActiveRecordUserRepository } from "./repositories/active-record-user.repository";
import { ActiveRecordRoleRepository } from "./repositories/active-record-role.repository";
import { ActiveRecordPermissionRepository } from "./repositories/active-record-permission.repository";
import { ActiveRecordSessionRepository } from "./repositories/active-record-session.repository";
import { ActiveRecordPasswordResetRepository } from "./repositories/active-record-password-reset.repository";
import { ActiveRecordEmailVerificationRepository } from "./repositories/active-record-email-verification.repository";

import {
  PASSWORD_HASHER,
  SECRET_CIPHER,
  TOKEN_GENERATOR,
} from "../../domain/auth/ports";
import { BcryptPasswordHasher } from "./adapters/bcrypt-password-hasher";
import { OsloTokenGenerator } from "./adapters/oslo-token-generator";
import { AesSecretCipher } from "./adapters/aes-secret-cipher";

export class AuthServiceProvider extends ServiceProvider {
  register(): void {
    // Cryptographic ports → concrete adapters
    this.container.register({
      token: PASSWORD_HASHER,
      useClass: BcryptPasswordHasher,
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
    // Bind the auth context once so facades and `logic` helpers never resolve
    // services through the container themselves.
    bindAuthContext({
      user: await this.container.resolve(UserService),
      session: await this.container.resolve(SessionService),
      rbac: await this.container.resolve(RbacService),
      passwordReset: await this.container.resolve(PasswordResetService),
      emailVerification: await this.container.resolve(EmailVerificationService),
      auth: await this.container.resolve(AuthService),
    });

    if (await isSystemInstalled()) {
      const emailService = await this.container.resolve(
        EmailVerificationService,
      );
      await emailService.initEmailVerification();
    }
  }
}
