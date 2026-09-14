"use server";

import { authContext } from "../context";
import type {
  AuthSession,
  Session as SessionType,
  SessionFlags,
  UserSession,
} from "../../../domain/auth/types";
import { cache } from "react";

export async function getIPAddress(): Promise<string | null> {
  return authContext().session.getIPAddress();
}

export async function validateSessionToken(
  token: string,
): Promise<AuthSession> {
  return authContext().session.validateSessionToken(token);
}

export const getCurrentSession = cache(async (): Promise<AuthSession> => {
  return authContext().session.getCurrentSession();
});

export async function invalidateSession(sessionId: string): Promise<void> {
  return authContext().session.invalidateSession(sessionId);
}

export async function invalidateUserSessions(userId: string): Promise<void> {
  return authContext().session.invalidateUserSessions(userId);
}

export async function setSessionTokenCookie(
  token: string,
  expiresAt: Date,
): Promise<void> {
  return authContext().session.setSessionTokenCookie(token, expiresAt);
}

export async function deleteSessionTokenCookie(): Promise<void> {
  return authContext().session.deleteSessionTokenCookie();
}

export async function generateSessionToken(): Promise<string> {
  return authContext().session.generateSessionToken();
}

export async function createSession(
  token: string,
  userId: string,
  flags: SessionFlags,
): Promise<SessionType> {
  return authContext().session.createSession(token, userId, flags);
}

export async function updateSessionMetadata(
  flags: SessionFlags,
): Promise<void> {
  return authContext().session.updateSessionMetadata(flags);
}

export async function sessionSignOut(): Promise<void> {
  return authContext().session.sessionSignOut();
}

export async function getUserSessions(
  userId: string,
  currentSessionId: string,
): Promise<UserSession[]> {
  return authContext().session.getUserSessions(userId, currentSessionId);
}

export async function invalidateOtherSessions(
  userId: string,
  currentSessionId: string,
): Promise<void> {
  return authContext().session.invalidateOtherSessions(
    userId,
    currentSessionId,
  );
}
