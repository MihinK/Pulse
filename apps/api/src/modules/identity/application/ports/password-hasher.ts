/** Argon2id in production (`Argon2PasswordHasher`), per requirements section 3.4. */
export interface PasswordHasher {
  hash(plainText: string): Promise<string>;
  verify(passwordHash: string, plainText: string): Promise<boolean>;
}
