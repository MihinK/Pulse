import { Injectable } from "@nestjs/common";
import * as argon2 from "argon2";
import type { PasswordHasher } from "../application/ports/password-hasher";

/** Requirements section 3.4: "Passwords hashed with Argon2 or bcrypt." */
@Injectable()
export class Argon2PasswordHasher implements PasswordHasher {
  public hash(plainText: string): Promise<string> {
    return argon2.hash(plainText, { type: argon2.argon2id });
  }

  public async verify(passwordHash: string, plainText: string): Promise<boolean> {
    try {
      return await argon2.verify(passwordHash, plainText);
    } catch {
      return false;
    }
  }
}
