import { AesGcmSecretCipher } from "./aes-gcm-secret-cipher";

describe("AesGcmSecretCipher", () => {
  it("round-trips a plaintext value", () => {
    const cipher = new AesGcmSecretCipher("test-encryption-key");

    const ciphertext = cipher.encrypt("super-secret-token");

    expect(cipher.decrypt(ciphertext)).toBe("super-secret-token");
  });

  it("produces different ciphertext for the same plaintext (random IV)", () => {
    const cipher = new AesGcmSecretCipher("test-encryption-key");

    const a = cipher.encrypt("same-value");
    const b = cipher.encrypt("same-value");

    expect(a.equals(b)).toBe(false);
  });

  it("fails to decrypt with a different key", () => {
    const cipher = new AesGcmSecretCipher("test-encryption-key");
    const other = new AesGcmSecretCipher("a-completely-different-key");

    const ciphertext = cipher.encrypt("super-secret-token");

    expect(() => other.decrypt(ciphertext)).toThrow();
  });

  it("fails to decrypt tampered ciphertext", () => {
    const cipher = new AesGcmSecretCipher("test-encryption-key");
    const ciphertext = cipher.encrypt("super-secret-token");
    const tampered = Buffer.from(ciphertext);
    tampered[tampered.length - 1] = (tampered[tampered.length - 1] ?? 0) ^ 0xff;

    expect(() => cipher.decrypt(tampered)).toThrow();
  });
});
