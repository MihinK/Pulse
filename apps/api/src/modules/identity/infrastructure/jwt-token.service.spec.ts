import { JwtService } from "@nestjs/jwt";
import { JwtTokenService } from "./jwt-token.service";
import { Role } from "../domain/role.enum";
import type { Principal } from "../../../common/auth/principal";

describe("JwtTokenService", () => {
  const principal: Principal = { userId: "u1", organizationId: "org-1", role: Role.ADMIN };

  it("round-trips a principal through sign and verify", () => {
    const jwtService = new JwtService({ secret: "test-secret", signOptions: { expiresIn: "15m" } });
    const service = new JwtTokenService(jwtService);

    const token = service.signAccessToken(principal);
    const verified = service.verifyAccessToken(token);

    expect(verified).toEqual(principal);
  });

  it("round-trips a Platform Owner principal (null organizationId)", () => {
    const jwtService = new JwtService({ secret: "test-secret", signOptions: { expiresIn: "15m" } });
    const service = new JwtTokenService(jwtService);
    const owner: Principal = { userId: "u2", organizationId: null, role: Role.PLATFORM_OWNER };

    const token = service.signAccessToken(owner);

    expect(service.verifyAccessToken(token)).toEqual(owner);
  });

  it("rejects a token signed with a different secret", () => {
    const signer = new JwtService({ secret: "secret-a", signOptions: { expiresIn: "15m" } });
    const verifier = new JwtTokenService(
      new JwtService({ secret: "secret-b", signOptions: { expiresIn: "15m" } }),
    );
    const token = new JwtTokenService(signer).signAccessToken(principal);

    expect(() => verifier.verifyAccessToken(token)).toThrow();
  });

  it("rejects an expired token", () => {
    const jwtService = new JwtService({ secret: "test-secret", signOptions: { expiresIn: "-1s" } });
    const service = new JwtTokenService(jwtService);

    const token = service.signAccessToken(principal);

    expect(() => service.verifyAccessToken(token)).toThrow();
  });

  it("rejects a garbage token", () => {
    const service = new JwtTokenService(new JwtService({ secret: "test-secret" }));

    expect(() => service.verifyAccessToken("not-a-jwt")).toThrow();
  });
});
