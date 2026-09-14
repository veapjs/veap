import { coreRbacAugmenter } from "./rbac-logic";
import type {
  AuthResponse,
  FullUser,
  Session,
  User,
  UserPermission,
  UserRole,
} from "../../domain/auth/types";

import {
  augmentSession,
  augmentUser,
  registerIdentityAugmenter,
  registerPasswordResetSessionAugmenter,
  registerSessionAugmenter,
} from "./augment";

/**
 * Registry for login validators (e.g. 2FA module)
 */
export type AuthValidator = (userId: string) => Promise<AuthResponse | null>;

/**
 * Registry for Security Requirements (e.g. checking if 2FA is needed for a session)
 */
export type SecurityRequirement = (
  session: Session,
  user: FullUser,
  /**
   * Request path the security check is running for ("/app/jobs", "/", ...).
   * Lets a requirement exempt the route that resolves its own gate (e.g. an
   * onboarding wizard) and prevents redirect loops.
   */
  path?: string,
) => Promise<{ satisfied: boolean; redirect?: string } | null>;

/**
 * Registry for password reset validators (e.g. 2FA module requiring check during reset)
 */
export type PasswordResetValidator = (
  userId: string,
) => Promise<AuthResponse | null>;

/**
 * Registry for email verification validators
 */
export type EmailVerificationValidator = (
  userId: string,
) => Promise<AuthResponse | null>;

const globalForAuth = globalThis as unknown as {
  __VEAP_AUTH_VALIDATORS__: Set<AuthValidator> | undefined;
  __VEAP_SECURITY_REQUIREMENTS__: Set<SecurityRequirement> | undefined;
  __VEAP_PASSWORD_RESET_VALIDATORS__: Set<PasswordResetValidator> | undefined;
  __VEAP_EMAIL_VERIFICATION_VALIDATORS__:
    Set<EmailVerificationValidator> | undefined;
};

export const authValidators =
  globalForAuth.__VEAP_AUTH_VALIDATORS__ ?? new Set<AuthValidator>();
const securityRequirements =
  globalForAuth.__VEAP_SECURITY_REQUIREMENTS__ ??
  new Set<SecurityRequirement>();
const passwordResetValidators =
  globalForAuth.__VEAP_PASSWORD_RESET_VALIDATORS__ ??
  new Set<PasswordResetValidator>();
const emailVerificationValidators =
  globalForAuth.__VEAP_EMAIL_VERIFICATION_VALIDATORS__ ??
  new Set<EmailVerificationValidator>();

globalForAuth.__VEAP_AUTH_VALIDATORS__ = authValidators;
globalForAuth.__VEAP_SECURITY_REQUIREMENTS__ = securityRequirements;
globalForAuth.__VEAP_PASSWORD_RESET_VALIDATORS__ = passwordResetValidators;
globalForAuth.__VEAP_EMAIL_VERIFICATION_VALIDATORS__ =
  emailVerificationValidators;

export async function registerAuthValidator(validator: AuthValidator) {
  authValidators.add(validator);
}

export async function registerPasswordResetValidator(
  validator: PasswordResetValidator,
) {
  passwordResetValidators.add(validator);
}

export async function registerEmailVerificationValidator(
  validator: EmailVerificationValidator,
) {
  emailVerificationValidators.add(validator);
}

export {
  augmentSession,
  augmentUser,
  registerIdentityAugmenter,
  registerPasswordResetSessionAugmenter,
  registerSessionAugmenter,
};

export async function registerSecurityRequirement(
  requirement: SecurityRequirement,
) {
  securityRequirements.add(requirement);
}

export async function runPasswordResetValidators(
  userId: string,
): Promise<AuthResponse | null> {
  for (const validator of passwordResetValidators) {
    const interception = await validator(userId);
    if (interception) return interception;
  }
  return null;
}

export async function runEmailVerificationValidators(
  userId: string,
): Promise<AuthResponse | null> {
  for (const validator of emailVerificationValidators) {
    const interception = await validator(userId);
    if (interception) return interception;
  }
  return null;
}

/**
 * Augments a base user with data from all registered modules.
 * This is now just a wrapper that includes core RBAC data.
 */
export async function performFullUserAugmentation(
  user: User,
  _session?: Session,
): Promise<FullUser> {
  const coreRbacData = await coreRbacAugmenter(user);
  // Organization augmentation removed
  return await augmentUser(user, coreRbacData);
}

/**
 * Checks if the current session satisfies all registered security requirements.
 */
export async function checkSecurity(
  session: Session,
  user: FullUser,
  requiredRoles?: UserRole[],
  requiredPermissions?: UserPermission[],
  fallbackRedirect?: string,
  /** Request path this check runs for; forwarded to modular requirements. */
  path?: string,
) {
  if (!user) {
    console.warn("User is required for security check");
    return { satisfied: false, redirect: fallbackRedirect ?? "/signin" };
  }

  // Organization UI disabled
  const userRoles = Array.isArray(user.roles) ? user.roles : [];
  const userPermissions = Array.isArray(user.permissions)
    ? user.permissions
    : [];

  // 1. Core Role Check (At least one role must match)
  if (requiredRoles && requiredRoles.length > 0) {
    const hasRole = requiredRoles.some((role) => userRoles.includes(role));
    if (!hasRole) {
      console.warn(`User lacks required roles: ${requiredRoles.join(", ")}`);
      return {
        satisfied: false,
        redirect: fallbackRedirect,
      };
    }
  }

  // 2. Core Permission Check (ALL permissions must match)
  if (requiredPermissions && requiredPermissions.length > 0) {
    const hasAllPermissions = requiredPermissions.every((perm) =>
      userPermissions.includes(perm),
    );
    if (!hasAllPermissions) {
      console.warn(
        `User lacks required permissions: ${requiredPermissions.join(", ")}`,
      );

      return {
        satisfied: false,
        redirect: fallbackRedirect,
      };
    }
  }

  // 3. Modular Requirements Check
  if (securityRequirements) {
    for (const requirement of securityRequirements) {
      try {
        const result = await requirement(session, user, path);
        if (result && !result.satisfied) {
          return {
            ...result,
            redirect: result.redirect ?? fallbackRedirect,
          };
        }
      } catch (error) {
        console.error("[veap:security] Requirement failed:", error);
      }
    }
  }
  return { satisfied: true };
}
