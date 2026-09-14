import { decryptToString, encryptString } from "../utils/encryption";

import type { ISecretCipher } from "../../../domain/auth/ports/secret-cipher";

/**
 * AES-GCM adapter for the {@link ISecretCipher} port.
 *
 * Delegates to the existing `utils/encryption` implementation (the only place
 * holding the ENCRYPTION_KEY logic); application services see the port
 * injected via `SECRET_CIPHER`.
 */
export class AesSecretCipher implements ISecretCipher {
  public encrypt(secret: string): Uint8Array {
    return encryptString(secret);
  }

  public decryptToString(data: Uint8Array): string {
    return decryptToString(data);
  }
}
