"use server";

import { authContext } from "../context";
import type { EmailVerificationRequestType } from "../services/email-verification.service";

export type { EmailVerificationRequestType };

export async function initEmailVerification() {
  return authContext().emailVerification.initEmailVerification();
}

export async function getUserEmailVerificationRequest(
  userId: string,
  id: string,
) {
  return authContext().emailVerification.getUserEmailVerificationRequest(
    userId,
    id,
  );
}

export async function createEmailVerificationRequest(
  userId: string,
  email: string,
) {
  return authContext().emailVerification.createEmailVerificationRequest(
    userId,
    email,
  );
}

export async function deleteUserEmailVerificationRequest(userId: string) {
  return authContext().emailVerification.deleteUserEmailVerificationRequest(
    userId,
  );
}

export async function sendVerificationEmail(email: string, code: string) {
  return authContext().emailVerification.sendVerificationEmail(email, code);
}

export async function setEmailVerificationRequestCookie(
  request: EmailVerificationRequestType,
) {
  return authContext().emailVerification.setEmailVerificationRequestCookie(
    request,
  );
}

export async function deleteEmailVerificationRequestCookie() {
  return authContext().emailVerification.deleteEmailVerificationRequestCookie();
}

export async function getUserEmailVerificationRequestFromRequest() {
  return authContext().emailVerification.getUserEmailVerificationRequestFromRequest();
}
