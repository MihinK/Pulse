import { Argon2PasswordHasher } from "./argon2-password-hasher";

describe("Argon2PasswordHasher", () => {
  const hasher = new Argon2PasswordHasher();

  it("hashes a password to an argon2id string", async () => {
    const hash = await hasher.hash("correct horse battery staple");

    expect(hash).toMatch(/^\$argon2id\$/);
  });

  it("verifies the correct password", async () => {
    const hash = await hasher.hash("correct horse battery staple");

    await expect(hasher.verify(hash, "correct horse battery staple")).resolves.toBe(true);
  });

  it("rejects the wrong password", async () => {
    const hash = await hasher.hash("correct horse battery staple");

    await expect(hasher.verify(hash, "wrong password")).resolves.toBe(false);
  });

  it("rejects a malformed hash instead of throwing", async () => {
    await expect(hasher.verify("not-a-real-hash", "anything")).resolves.toBe(false);
  });
});
