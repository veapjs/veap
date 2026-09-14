import { User } from "../models/User";
import type {
  CreateUserRecord,
  IUserRepository,
  UpdateUserRecord,
} from "../../../domain/auth/repositories/user.repository";
import type { User as UserEntity } from "../../../domain/auth/types";

/**
 * `IUserRepository` adapter backed by the `User` ActiveRecord model.
 *
 * This is the only place that knows how users are persisted, so the
 * application layer can be tested with an in-memory fake.
 */
export class ActiveRecordUserRepository implements IUserRepository {
  async create(record: CreateUserRecord): Promise<UserEntity> {
    const user = await User.create({
      email: record.email,
      name: record.name,
      password: record.password ?? null,
      image: record.image ?? null,
      emailVerifiedAt: record.emailVerifiedAt ?? null,
      recovery_code: record.recoveryCode,
    });

    return user.toJSON() as UserEntity;
  }

  async findById(id: string): Promise<UserEntity | null> {
    const user = await User.find(id);
    return user ? (user.toJSON() as UserEntity) : null;
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    const user = await User.where("email", email).first();
    return user ? (user.toJSON() as UserEntity) : null;
  }

  async findPasswordHash(id: string): Promise<string | null | undefined> {
    const user = await User.find(id);
    if (!user) return undefined;
    return user.password ?? null;
  }

  async findRecoveryCode(id: string): Promise<Uint8Array | null | undefined> {
    const user = await User.find(id);
    if (!user) return undefined;
    return (user.recovery_code as Uint8Array | null) ?? null;
  }

  async update(id: string, changes: UpdateUserRecord): Promise<void> {
    if (Object.keys(changes).length === 0) return;
    await User.where("id", id).update(changes);
  }

  async setRecoveryCode(id: string, encrypted: Uint8Array): Promise<void> {
    const user = await User.find(id);
    if (!user) return;
    user.setAttribute("recovery_code", Buffer.from(encrypted));
    await user.save();
  }

  async setEmailVerifiedIfEmailMatches(
    id: string,
    email: string,
  ): Promise<boolean> {
    const updated = await User.where({ id, email }).update({
      emailVerifiedAt: new Date(),
    });

    return updated > 0;
  }
}
