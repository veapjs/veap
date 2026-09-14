import { AppError } from "../../domain/errors/app-error";
import type { AuthService } from "./services/auth.service";
import type { EmailVerificationService } from "./services/email-verification.service";
import type { PasswordResetService } from "./services/password-reset.service";
import type { RbacService } from "./services/rbac.service";
import type { SessionService } from "./services/session.service";
import type { UserService } from "./services/user.service";

/**
 * Typed boundary between the auth use cases and the modules that consume them
 * (server-action facades, `logic` helpers).
 *
 * The composition root (`AuthServiceProvider`) resolves the concrete services
 * once at boot and binds them here. Consumers therefore declare their whole
 * dependency surface in one place instead of reaching into the IoC container
 * with ad-hoc `app(Service)` lookups.
 */
export interface AuthContext {
  user: UserService;
  session: SessionService;
  rbac: RbacService;
  passwordReset: PasswordResetService;
  emailVerification: EmailVerificationService;
  auth: AuthService;
}

const globalForAuthContext = globalThis as unknown as {
  __VEAP_AUTH_CONTEXT__?: AuthContext;
};

/**
 * Binds the resolved auth services. Called once by the composition root.
 */
export function bindAuthContext(context: AuthContext): void {
  globalForAuthContext.__VEAP_AUTH_CONTEXT__ = context;
}

/**
 * Returns the bound auth services.
 *
 * @throws If the auth service provider has not booted yet.
 */
export function authContext(): AuthContext {
  const context = globalForAuthContext.__VEAP_AUTH_CONTEXT__;
  if (!context) {
    throw AppError.Internal(
      "[Auth] Context is not bound. AuthServiceProvider must boot before the auth facades are used.",
    );
  }
  return context;
}
