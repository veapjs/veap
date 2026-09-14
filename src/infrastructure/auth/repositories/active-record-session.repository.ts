import { Session } from "../models/Session";
import type {
  CreateSessionRecord,
  ISessionRepository,
  SessionWithUser,
} from "../../../domain/auth/repositories/session.repository";
import type { Session as SessionEntity } from "../../../domain/auth/types";

/**
 * `ISessionRepository` adapter backed by the `Session` ActiveRecord model.
 *
 * ORM quirks (`getRelation`, attribute casing) are confined here so the
 * application service can work with plain objects.
 */
export class ActiveRecordSessionRepository implements ISessionRepository {
  async create(record: CreateSessionRecord): Promise<SessionEntity> {
    const session = await Session.create({
      id: record.id,
      expiresAt: record.expiresAt,
      userId: record.userId,
      metadata: record.metadata ?? {},
    });

    return session.toJSON() as SessionEntity;
  }

  async findWithUser(id: string): Promise<SessionWithUser | null> {
    const session = await Session.query().with("user").find(id);
    if (!session) return null;

    const user = session.getRelation("user") || (session as any).user;
    if (!user) return null;

    return {
      session: session.toJSON() as SessionEntity,
      user: (typeof user.toJSON === "function"
        ? user.toJSON()
        : user) as Record<string, any>,
    };
  }

  async findById(id: string): Promise<SessionEntity | null> {
    const session = await Session.find(id);
    return session ? (session.toJSON() as SessionEntity) : null;
  }

  async findByUserId(userId: string): Promise<SessionEntity[]> {
    const sessions = await Session.where("user_id", userId).get();
    return sessions.map((session) => session.toJSON() as SessionEntity);
  }

  async updateMetadata(
    id: string,
    metadata: Record<string, any>,
  ): Promise<void> {
    await Session.where("id", id).update({
      metadata,
      updatedAt: new Date(),
    });
  }

  async remove(id: string): Promise<void> {
    await Session.destroy(id);
  }

  async removeByUserId(userId: string): Promise<void> {
    await Session.where("user_id", userId).delete();
  }

  async removeOtherUserSessions(
    userId: string,
    currentSessionId: string,
  ): Promise<void> {
    await Session.where("user_id", userId)
      .toKnex()
      .where("id", "!=", currentSessionId)
      .delete();
  }
}
