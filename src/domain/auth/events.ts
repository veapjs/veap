import type { Session, User } from "./types";

export type AuthEventPayloads = {
  /**
   * Emitted after password/base credentials are verified,
   * but BEFORE the final session is created.
   * Listeners can return a "veto" to require additional factors.
   */
  "system:auth:validate-factors": {
    userId: string;
    email: string;
  };

  /**
   * Emitted after a full session is successfully created.
   */
  "system:auth:session-created": {
    session: Session;
    user: User;
  };

  "system:auth:login": {
    session: Session;
    user: User;
  };

  /**
   * Emitted after a new user successfully signs up.
   */
  "system:auth:signup": {
    session: Session;
    user: User;
  };

  /**
   * Emitted after a user signs out.
   */
  "system:auth:signed-out": {
    user: User;
  };

  /**
   * Emitted when a password reset is requested.
   */
  "system:auth:password-reset:requested": {
    userId: string;
    email: string;
  };

  /**
   * Emitted when a password has been successfully reset.
   */
  "system:auth:password-reset:completed": {
    userId: string;
  };

  /**
   * Emitted when a verification email is sent.
   */
  "system:auth:verification-requested": {
    userId: string;
    email: string;
  };

  /**
   * Emitted when a user successfully verifies their email.
   */
  "system:auth:email-verified": {
    userId: string;
    email: string;
  };
};
