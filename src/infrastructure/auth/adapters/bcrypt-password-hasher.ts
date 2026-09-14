import bcrypt from "bcryptjs";

import type { IPasswordHasher } from "../../../domain/auth/ports/password-hasher";

/**
 * Bcrypt adapter for the {@link IPasswordHasher} port.
 *
 * The only place in the auth context that knows about bcrypt - application
 * services see the port injected via `PASSWORD_HASHER`.
 */
export class BcryptPasswordHasher implements IPasswordHasher {
  public async hash(password: string): Promise<string> {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
  }

  public async verify(hash: string, password: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
  }

  public async validateStrength(password: string): Promise<boolean> {
    return password.length >= 8 && password.length <= 255;
  }
}
