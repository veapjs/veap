/**
 * Secret-at-rest encryption port.
 *
 * User recovery codes are stored encrypted (AES-GCM today). The use case only
 * needs "turn a secret string into bytes and back"; the key management and
 * algorithm are infrastructure concerns. The adapter lives in
 * `infrastructure/auth/adapters/` and is bound to `SECRET_CIPHER` by
 * `AuthServiceProvider`.
 */
export interface ISecretCipher {
  /** Encrypts a secret string into storable bytes. */
  encrypt(secret: string): Uint8Array;

  /** Decrypts stored bytes back into the secret string. */
  decryptToString(data: Uint8Array): string;
}

export const SECRET_CIPHER = Symbol.for("veap:auth:secret-cipher");
