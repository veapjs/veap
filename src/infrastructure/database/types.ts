import type {
  EmailVerificationAttributes,
  PasswordResetSessionAttributes,
  SessionAttributes,
  UserAttributes,
} from "../auth/models/index";
import type { SystemPluginAttributes } from "../plugins/models/index";
import type { SettingAttributes } from "../settings/models/index";

export type UserRecord = UserAttributes;
export type AddUser = Partial<UserAttributes> & { email: string; name: string };

export type SessionRecord = SessionAttributes;
export type AddSession = Partial<SessionAttributes> & { expiresAt: Date };

export type SystemPluginRecord = SystemPluginAttributes;
export type SettingRecord = SettingAttributes;

export type EmailVerificationRequest = EmailVerificationAttributes;
export type AddEmailVerificationRequest =
  Partial<EmailVerificationAttributes> & {
    email: string;
    code: string;
    userId: string;
    expiresAt: Date;
  };

export type PasswordResetSessionRecord = PasswordResetSessionAttributes;
export type AddPasswordResetSession =
  Partial<PasswordResetSessionAttributes> & {
    email: string;
    code: string;
    userId: string;
    expiresAt: Date;
  };
