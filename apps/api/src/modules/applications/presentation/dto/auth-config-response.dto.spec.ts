import { AuthConfigResponseDto } from "./auth-config-response.dto";
import { AuthType } from "../../domain/auth-type.enum";

describe("AuthConfigResponseDto.fromSummary", () => {
  it("maps only the type", () => {
    const dto = AuthConfigResponseDto.fromSummary({ type: AuthType.BEARER });

    expect(dto.type).toBe(AuthType.BEARER);
    expect(Object.keys(dto)).toEqual(["type"]);
  });
});
