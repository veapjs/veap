import { User } from "../models";

/**
 * Validates the email format and length.
 */
export function verifyEmailInput(email: string): boolean {
  return /^.+@.+\..+$/.test(email) && email.length < 256 && email.length > 0;
}

/**
 * Checks if an email address is already in use.
 * @returns True if the email is available, false otherwise.
 */
export async function checkEmailAvailability(email: string): Promise<boolean> {
  const exists = await User.where("email", email).exists();
  return !exists;
}
