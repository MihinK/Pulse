import { OrganizationResponseDto } from "./organization-response.dto";
import { Organization } from "../../domain/organization.entity";
import { Edition } from "../../domain/edition.enum";

describe("OrganizationResponseDto.fromDomain", () => {
  it("maps an organization to the wire shape", () => {
    const org = new Organization("Acme", "acme", "UTC", Edition.CLOUD);

    const dto = OrganizationResponseDto.fromDomain(org);

    expect(dto.id).toBe(org.id);
    expect(dto.name).toBe("Acme");
    expect(dto.slug).toBe("acme");
    expect(dto.status).toBe("ACTIVE");
    expect(dto.edition).toBe("CLOUD");
    expect(dto.defaultTimeZone).toBe("UTC");
    expect(dto.createdAt).toBe(org.createdAt.toISOString());
  });
});
