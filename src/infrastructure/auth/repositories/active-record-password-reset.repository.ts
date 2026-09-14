import { PasswordResetSession } from "../models/PasswordResetSession";
import type {
  CreatePasswordResetRecord,
  IPasswordResetRepository,
  PasswordResetWithUser,
} from "../../../domain/auth/repositories/password-reset.repository";
import type { PasswordResetSession as PasswordResetSessionEntity } from "../../../domain/auth/types";

/** `IPasswordResetRepository` adapter backed by `PasswordResetSession`. */
export class ActiveRecordPasswordResetRepository implements IPasswordResetRepository {
  async create(
    record: CreatePasswordResetRecord,
  ): Promise<PasswordResetSessionEntity> {
    const session = await PasswordResetSession.create({
      id: record.id,
      email: record.email,
      code: record.code,
      expiresAt: record.expiresAt,
      userId: record.userId,
    });

    return session.toJSON() as PasswordResetSessionEntity;
  }

  async findWithUser(id: string): Promise<PasswordResetWithUser | null> {
    const session = await PasswordResetSession.query().with("user").find(id);
    if (!session) return null;

    const user = session.getRelation("user");
    if (!user) return null;

    return {
      session: session.toJSON() as PasswordResetSessionEntity,
      user: (typeof (user as any).toJSON === "function"
        ? (user as any).toJSON()
        : user) as Record<string, any>,
    };
  }

  async setEmailVerified(id: string): Promise<void> {
    await PasswordResetSession.where("id", id).update({
      emailVerified: true,
    });
  }

  async remove(id: string): Promise<void> {
    await PasswordResetSession.destroy(id);
  }

  async removeByUserId(userId: string): Promise<void> {
    await PasswordResetSession.where("user_id", userId).delete();
  }
}
