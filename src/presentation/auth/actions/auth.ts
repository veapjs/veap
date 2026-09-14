"use server";

import { app } from "../../../infrastructure/ioc/container";
import { AuthService } from "../../../application/auth/services/auth.service";
import type {
  LoginInput,
  RegisterInput,
} from "../../../domain/auth/validation";
import type { AuthResponse, SessionFlags } from "../../../domain/auth/types";
import { ok, type Result } from "../../../domain/errors/result";
import { handleActionError } from "../../../presentation/errors/handler";

export async function signIn(data: LoginInput): Promise<Result<AuthResponse>> {
  try {
    return ok(await (await app(AuthService)).signIn(data));
  } catch (e) {
    return handleActionError(e, "Auth:SignIn");
  }
}

export async function signUp(data: RegisterInput) {
  try {
    return ok(await (await app(AuthService)).signUp(data));
  } catch (e) {
    return handleActionError(e, "Auth:SignUp");
  }
}

export async function finalizeLogin(userId: string, flags: SessionFlags) {
  try {
    return ok(await (await app(AuthService)).finalizeLogin(userId, flags));
  } catch (e) {
    return handleActionError(e, "Auth:FinalizeLogin");
  }
}

export async function signOut(): Promise<Result<void>> {
  try {
    await (await app(AuthService)).signOut();
    return ok(undefined);
  } catch (e) {
    return handleActionError(e, "Auth:SignOut");
  }
}
