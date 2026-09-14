import { EmailVerification } from "../models/EmailVerification";
import type {
  CreateEmailVerificationRecord,
  EmailVerificationRecord,
  IEmailVerificationRepository,
} from "../../../domain/auth/repositories/email-verification.repository";

/** `IEmailVerificationRepository` adapter backed by `EmailVerification`. */
export class ActiveRecordEmailVerificationRepository implements IEmailVerificationRepository {
  async create(
    record: CreateEmailVerificationRecord,
  ): Promise<EmailVerificationRecord> {
    const request = await EmailVerification.create({
      userId: record.userId,
      code: record.code,
      email: record.email,
      expiresAt: record.expiresAt,
    });

    return request.toJSON() as EmailVerificationRecord;
  }

  async findForUser(
    userId: string,
    id: string,
  ): Promise<EmailVerificationRecord | null> {
    const request = await EmailVerification.where({
      id,
      user_id: userId,
    }).first();

    return request ? (request.toJSON() as EmailVerificationRecord) : null;
  }

  async removeByUserId(userId: string): Promise<void> {
    await EmailVerification.where("user_id", userId).delete();
  }
}
