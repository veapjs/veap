import { AppError } from "../../../domain/errors/app-error";
import { Inject, Injectable } from "../../../domain/contracts/ioc";
import {
  ROLE_REPOSITORY,
  type IRoleRepository,
} from "../../../domain/auth/repositories/role.repository";
import {
  USER_REPOSITORY,
  type IUserRepository,
} from "../../../domain/auth/repositories/user.repository";
import { sendRecoveryCode } from "../../communication/mail";
import type { User } from "../../../domain/auth/types";
import {
  PASSWORD_HASHER,
  type IPasswordHasher,
} from "../../../domain/auth/ports/password-hasher";
import {
  SECRET_CIPHER,
  type ISecretCipher,
} from "../../../domain/auth/ports/secret-cipher";
import {
  TOKEN_GENERATOR,
  type ITokenGenerator,
} from "../../../domain/auth/ports/token-generator";

const DEFAULT_ROLE = "user";

@Injectable()
export class UserService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    @Inject(ROLE_REPOSITORY) private readonly roles: IRoleRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: IPasswordHasher,
    @Inject(TOKEN_GENERATOR) private readonly tokens: ITokenGenerator,
    @Inject(SECRET_CIPHER) private readonly cipher: ISecretCipher,
  ) {}

  /**
   * Validates the username input.
   */
  public async verifyUsernameInput(username: string): Promise<boolean> {
    return (
      username.length > 3 &&
      username.length < 32 &&
      username.trim() === username
    );
  }

  /**
   * Creates a new user with an initial recovery code and default 'user' role.
   */
  public async createUser(
    email: string,
    username: string,
    password: string,
  ): Promise<User> {
    const passwordHash = await this.hasher.hash(password);
    const recoveryCode = this.tokens.generateRecoveryCode();

    const user = await this.users.create({
      email,
      name: username,
      password: passwordHash,
      recoveryCode: this.cipher.encrypt(recoveryCode),
    });

    await this.assignDefaultRole(user.id);
    await sendRecoveryCode(user.email, recoveryCode);

    return user;
  }

  /**
   * Creates a new user from an OAuth provider.
   */
  public async createOAuthUser(
    email: string,
    name: string,
    image?: string,
  ): Promise<User> {
    const recoveryCode = this.tokens.generateRecoveryCode();

    const user = await this.users.create({
      email,
      name,
      image,
      emailVerifiedAt: new Date(),
      recoveryCode: this.cipher.encrypt(recoveryCode),
    });

    await this.assignDefaultRole(user.id);

    return user;
  }

  /**
   * Returns a user by ID.
   */
  public async getUserById(userId: string): Promise<User | null> {
    return await this.users.findById(userId);
  }

  /**
   * Decrypts and returns the user's recovery code.
   */
  public async getUserRecoverCode(userId: string): Promise<string> {
    const stored = await this.users.findRecoveryCode(userId);
    if (!stored) {
      throw AppError.BadRequest("Recovery code not found for user");
    }

    return this.cipher.decryptToString(stored);
  }

  /**
   * Generates and sets a new recovery code for the user.
   */
  public async resetUserRecoveryCode(userId: string): Promise<string> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw AppError.BadRequest("User not found");
    }

    const recoveryCode = this.tokens.generateRecoveryCode();
    await this.users.setRecoveryCode(userId, this.cipher.encrypt(recoveryCode));

    await sendRecoveryCode(user.email, recoveryCode);

    return recoveryCode;
  }

  /**
   * Updates the user's password.
   */
  public async updateUserPassword(
    userId: string,
    password: string,
  ): Promise<void> {
    const passwordHash = await this.hasher.hash(password);
    await this.users.update(userId, { password: passwordHash });
  }

  /**
   * Updates the user's name.
   */
  public async updateUserName(userId: string, name: string): Promise<void> {
    await this.users.update(userId, { name });
  }

  /**
   * Updates the user's image.
   */
  public async updateUserAwatar(userId: string, image: string): Promise<void> {
    await this.users.update(userId, { image });
  }

  /**
   * Updates the user's email and marks it as verified.
   */
  public async updateUserEmailAndSetEmailAsVerified(
    userId: string,
    email: string,
  ): Promise<void> {
    await this.users.update(userId, {
      email,
      emailVerifiedAt: new Date(),
    });
  }

  /**
   * Sets the user as email verified if the provided email matches.
   */
  public async setUserAsEmailVerifiedIfEmailMatches(
    userId: string,
    email: string,
  ): Promise<boolean> {
    return await this.users.setEmailVerifiedIfEmailMatches(userId, email);
  }

  /**
   * Returns the user's password hash.
   */
  public async getUserPasswordHash(userId: string): Promise<string | null> {
    const hash = await this.users.findPasswordHash(userId);
    if (hash === undefined) {
      throw AppError.BadRequest("User not found");
    }

    return hash;
  }

  /**
   * Returns a user by email.
   */
  public async getUserFromEmail(email: string): Promise<User | null> {
    return await this.users.findByEmail(email);
  }

  /**
   * Ensures the default 'user' role exists and assigns it.
   */
  private async assignDefaultRole(userId: string): Promise<void> {
    let role = await this.roles.findByName(DEFAULT_ROLE);
    if (!role) {
      role = await this.roles.create({
        name: DEFAULT_ROLE,
        description: "Default user role",
      });
    }

    await this.roles.assignToUser(userId, role.id);
  }
}
