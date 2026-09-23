import { ApplicationResponseDto } from "./application-response.dto";
import { Organization } from "../../../identity/domain/organization.entity";
import { Application } from "../../domain/application.entity";
import { Environment } from "../../domain/environment.enum";

describe("ApplicationResponseDto.fromDomain", () => {
  const org = new Organization("Acme", "acme", "UTC");

  it("maps an application to the wire shape", () => {
    const app = new Application(org, "API", "https://api.acme.test", Environment.PROD);

    const dto = ApplicationResponseDto.fromDomain(app);

    expect(dto.id).toBe(app.id);
    expect(dto.name).toBe("API");
    expect(dto.baseUrl).toBe("https://api.acme.test");
    expect(dto.environment).toBe(Environment.PROD);
    expect(dto.tags).toEqual([]);
    expect(dto.expectedStatuses).toBeNull();
    expect(dto.status).toBe("UNKNOWN");
    expect(dto.description).toBeUndefined();
  });

  it("includes description only when set", () => {
    const app = new Application(org, "API", "https://api.acme.test", Environment.PROD);
    app.update({ description: "desc" });

    const dto = ApplicationResponseDto.fromDomain(app);

    expect(dto.description).toBe("desc");
  });

  it("never includes auth credentials — there is no field for them", () => {
    const app = new Application(org, "API", "https://api.acme.test", Environment.PROD);

    const dto = ApplicationResponseDto.fromDomain(app);

    expect(dto).not.toHaveProperty("authConfig");
    expect(dto).not.toHaveProperty("configEncrypted");
  });
});
