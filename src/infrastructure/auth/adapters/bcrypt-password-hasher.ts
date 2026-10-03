import bcrypt from "bcryptjs";

import type { IPasswordHasher } from "../../../domain/auth/ports/password-hasher";

/**
 * Bcrypt adapter for the {@link IPasswordHasher} port.
 *
 * The only place in the auth context that knows about bcrypt - application
 * services see the port injected via `PASSWORD_HASHER`.
 */
export class BcryptPasswordHasher implements IPasswordHasher {
  public readonly rounds: number;
  public readonly minLength: number;

  constructor(rounds?: number, minLength?: number) {
    const envRounds = process.env.AUTH_BCRYPT_ROUNDS
      ? Number(process.env.AUTH_BCRYPT_ROUNDS)
      : NaN;
    const resolvedRounds = rounds !== undefined ? Number(rounds) : envRounds;
    this.rounds =
      !Number.isNaN(resolvedRounds) &&
      resolvedRounds >= 4 &&
      resolvedRounds <= 31
        ? Math.floor(resolvedRounds)
        : 10;

    const envMinLength = process.env.AUTH_PASSWORD_MIN_LENGTH
      ? Number(process.env.AUTH_PASSWORD_MIN_LENGTH)
      : NaN;
    const resolvedMinLength =
      minLength !== undefined ? Number(minLength) : envMinLength;
    this.minLength =
      !Number.isNaN(resolvedMinLength) && resolvedMinLength >= 1
        ? Math.floor(resolvedMinLength)
        : 8;
  }

  public async hash(password: string): Promise<string> {
    return await bcrypt.hash(password, this.rounds);
  }

  public async verify(hash: string, password: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
  }

  public async validateStrength(password: string): Promise<boolean> {
    return password.length >= this.minLength && password.length <= 255;
  }
}
