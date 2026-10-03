/** An email verification request as persisted. */
export interface EmailVerificationRecord {
  id: string;
  email: string;
  code: string;
  userId?: string;
  user_id?: string;
  expiresAt: Date;
  [key: string]: any;
}

export interface CreateEmailVerificationRecord {
  userId: string;
  email: string;
  code: string;
  expiresAt: Date;
}

/** Email verification request persistence port. */
export interface IEmailVerificationRepository {
  create(
    record: CreateEmailVerificationRecord,
  ): Promise<EmailVerificationRecord>;

  /** Finds a single request scoped to its owner. */
  findForUser(
    userId: string,
    id: string,
  ): Promise<EmailVerificationRecord | null>;

  removeByUserId(userId: string): Promise<void>;
}

/** Injection token for the email verification repository port. */
export const EMAIL_VERIFICATION_REPOSITORY = Symbol.for(
  "veap:auth:email-verification-repository",
);
