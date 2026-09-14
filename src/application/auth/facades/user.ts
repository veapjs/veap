"use server";

import { authContext } from "../context";
import type { User } from "../../../domain/auth/types";

export async function verifyUsernameInput(username: string): Promise<boolean> {
  return authContext().user.verifyUsernameInput(username);
}

export async function createUser(
  email: string,
  username: string,
  password: string,
): Promise<User> {
  return authContext().user.createUser(email, username, password);
}

export async function createOAuthUser(
  email: string,
  name: string,
  image?: string,
): Promise<User> {
  return authContext().user.createOAuthUser(email, name, image);
}

export async function getUserById(userId: string): Promise<User | null> {
  return authContext().user.getUserById(userId);
}

export async function getUserRecoverCode(userId: string): Promise<string> {
  return authContext().user.getUserRecoverCode(userId);
}

export async function resetUserRecoveryCode(userId: string): Promise<string> {
  return authContext().user.resetUserRecoveryCode(userId);
}

export async function updateUserPassword(
  userId: string,
  password: string,
): Promise<void> {
  return authContext().user.updateUserPassword(userId, password);
}

export async function updateUserName(
  userId: string,
  name: string,
): Promise<void> {
  return authContext().user.updateUserName(userId, name);
}

export async function updateUserAwatar(
  userId: string,
  image: string,
): Promise<void> {
  return authContext().user.updateUserAwatar(userId, image);
}

export async function updateUserEmailAndSetEmailAsVerified(
  userId: string,
  email: string,
): Promise<void> {
  return authContext().user.updateUserEmailAndSetEmailAsVerified(userId, email);
}

export async function setUserAsEmailVerifiedIfEmailMatches(
  userId: string,
  email: string,
): Promise<boolean> {
  return authContext().user.setUserAsEmailVerifiedIfEmailMatches(userId, email);
}

export async function getUserPasswordHash(
  userId: string,
): Promise<string | null> {
  return authContext().user.getUserPasswordHash(userId);
}

export async function getUserFromEmail(email: string): Promise<User | null> {
  return authContext().user.getUserFromEmail(email);
}
