import { Injectable } from "@nestjs/common";
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";
import type { SecretCipher } from "../application/ports/secret-cipher";

const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

/**
 * FR-APP-05: auth credentials encrypted at rest. The key comes from `SECRET_ENCRYPTION_KEY` (env
 * var, never hardcoded — same pattern as `JWT_ACCESS_SECRET`), hashed to exactly 32 bytes so any
 * passphrase length works as input. Ciphertext layout: `iv (12) | authTag (16) | ciphertext`.
 */
@Injectable()
export class AesGcmSecretCipher implements SecretCipher {
  private readonly key: Buffer;

  public constructor(encryptionKey: string) {
    this.key = createHash("sha256").update(encryptionKey).digest();
  }

  public encrypt(plaintext: string): Buffer {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, ciphertext]);
  }

  public decrypt(ciphertext: Buffer): string {
    const iv = ciphertext.subarray(0, IV_LENGTH);
    const authTag = ciphertext.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = ciphertext.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = createDecipheriv("aes-256-gcm", this.key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  }
}
