export type UserRole = "user" | "admin" | string;
export type UserPermission = string;

export interface User {
  id: string;
  email: string;
  name: string;
  password: string | null;
  image: string | null;
  recovery_code: any;
  emailVerifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date | null;
  [key: string]: any;
}

export interface Session {
  id: string;
  userId?: string;
  user_id?: string;
  metadata?: Record<string, any> | null;
  expiresAt: Date;
  expires_at?: Date;
  createdAt?: Date;
  created_at?: Date;
  updatedAt?: Date | null;
  updated_at?: Date | null;
  [key: string]: any;
}

export interface PasswordResetSession {
  id: string;
  email: string;
  code: string;
  emailVerified?: boolean | null;
  email_verified?: boolean | null;
  userId: string;
  user_id?: string;
  expiresAt: Date;
  expires_at?: Date;
  createdAt?: Date;
  created_at?: Date;
  updatedAt?: Date | null;
  updated_at?: Date | null;
  [key: string]: any;
}

/**
 * Represents a user with all potential extensions.
 * Use this type in UI components that require data added by modules.
 */
export type FullUser = User &
  Record<string, any> & {
    roles: UserRole[];
    permissions: UserPermission[];
  };

/**
 * Basic session context.
 */
export interface AuthSession {
  session: Session | null;
  user: FullUser | null;
}

export interface SessionFlags {
  [key: string]: any;
}

export type UserSession = {
  id: string;
  createdAt: Date;
  expiresAt: Date;
  isCurrent: boolean;
  [key: string]: any;
};

export type AuthResponse =
  | { status: "SUCCESS"; session: Session; user: FullUser; redirect?: string }
  | {
      status: "CHALLENGE_REQUIRED";
      type: string;
      userId: string;
      tempToken?: string;
      redirect?: string;
    }
  | { status: "ERROR"; message: string; redirect?: string };

export interface PasswordResetAuthSession {
  session: PasswordResetSession | null;
  user: FullUser | null;
}
