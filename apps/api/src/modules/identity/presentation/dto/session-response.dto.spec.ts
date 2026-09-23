import { SessionResponseDto } from "./session-response.dto";
import { Role } from "../../domain/role.enum";
import type { Session } from "../../application/auth.service";

describe("SessionResponseDto.fromSession", () => {
  it("maps a session to the wire shape", () => {
    const session: Session = {
      accessToken: "access-token",
      refreshToken: "refresh-token",
      principal: { userId: "u1", organizationId: "org-1", role: Role.ADMIN },
    };

    const dto = SessionResponseDto.fromSession(session);

    expect(dto).toEqual({
      accessToken: "access-token",
      userId: "u1",
      organizationId: "org-1",
      role: Role.ADMIN,
    });
  });

  it("maps a Platform Owner session (null organizationId)", () => {
    const session: Session = {
      accessToken: "access-token",
      refreshToken: "refresh-token",
      principal: { userId: "u2", organizationId: null, role: Role.PLATFORM_OWNER },
    };

    const dto = SessionResponseDto.fromSession(session);

    expect(dto.organizationId).toBeNull();
  });
});
