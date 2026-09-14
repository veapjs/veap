"use server";

import bcrypt from "bcryptjs";

/**
 * Hashes the password using bcrypt.
 * @param password Password to be hashed.
 * @returns Returns the hashed password.
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
  // return password;
}

/**
 * Verifies the password hash.
 * @param hash bcrypt hash.
 * @param password Password for comparison.
 * @returns Returns true if the password is correct, false otherwise.
 */
export async function verifyPasswordHash(
  hash: string,
  password: string,
): Promise<boolean> {
  return await bcrypt.compare(password, hash);
  // return password === hash;
}

/**
 * Validates password strength.
 * @param password Password to validate.
 * @returns Returns true if the password meets complexity requirements.
 */
export async function verifyPasswordStrength(
  password: string,
): Promise<boolean> {
  return password.length >= 8 && password.length <= 255;
}
