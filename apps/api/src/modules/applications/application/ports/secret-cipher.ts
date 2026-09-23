/** FR-APP-05: auth credentials are encrypted at rest, never returned by any read endpoint. */
export interface SecretCipher {
  encrypt(plaintext: string): Buffer;
  decrypt(ciphertext: Buffer): string;
}
