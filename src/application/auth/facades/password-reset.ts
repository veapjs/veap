"use server";

import { authContext } from "../context";
import type {
  PasswordResetAuthSession,
  PasswordResetSession as PasswordResetSessionType,
} from "../../../domain/auth/types";

export async function createPasswordResetSession(
  token: string,
  userId: string,
  email: string,
): Promise<PasswordResetSessionType> {
  return authContext().passwordReset.createPasswordResetSession(
    token,
    userId,
    email,
  );
}

export async function validatePasswordResetSessionToken(
  token: string,
): Promise<PasswordResetAuthSession> {
  return authContext().passwordReset.validatePasswordResetSessionToken(token);
}

export async function setPasswordResetSessionAsEmailVerified(
  sessionId: string,
): Promise<void> {
  return authContext().passwordReset.setPasswordResetSessionAsEmailVerified(
    sessionId,
  );
}

export async function invalidateUserPasswordResetSessions(
  userId: string,
): Promise<void> {
  return authContext().passwordReset.invalidateUserPasswordResetSessions(
    userId,
  );
}

export async function getCurrentPasswordResetSession(): Promise<PasswordResetAuthSession> {
  return authContext().passwordReset.getCurrentPasswordResetSession();
}

export async function setPasswordResetSessionTokenCookie(
  token: string,
  expiresAt: Date,
): Promise<void> {
  return authContext().passwordReset.setPasswordResetSessionTokenCookie(
    token,
    expiresAt,
  );
}

export async function deletePasswordResetSessionTokenCookie(): Promise<void> {
  return authContext().passwordReset.deletePasswordResetSessionTokenCookie();
}

export async function sendPasswordResetEmail(
  email: string,
  code: string,
): Promise<void> {
  return authContext().passwordReset.sendPasswordResetEmail(email, code);
}
