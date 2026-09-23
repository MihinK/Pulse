import { OrganizationsController } from "./organizations.controller";
import { Organization } from "../domain/organization.entity";
import type { OrganizationService } from "../application/organization.service";

describe("OrganizationsController", () => {
  const org = new Organization("Acme", "acme", "UTC");

  it("create delegates to the service and maps the result", async () => {
    const service = { create: jest.fn().mockResolvedValue(org) } as unknown as OrganizationService;
    const controller = new OrganizationsController(service);

    const dto = await controller.create({ name: "Acme", slug: "acme", defaultTimeZone: "UTC" });

    expect(service.create).toHaveBeenCalledWith("Acme", "acme", "UTC");
    expect(dto.id).toBe(org.id);
  });

  it("list maps every organization", async () => {
    const service = { list: jest.fn().mockResolvedValue([org]) } as unknown as OrganizationService;
    const controller = new OrganizationsController(service);

    const dtos = await controller.list();

    expect(dtos).toHaveLength(1);
    expect(dtos[0]?.slug).toBe("acme");
  });

  it("getById maps a single organization", async () => {
    const service = { getById: jest.fn().mockResolvedValue(org) } as unknown as OrganizationService;
    const controller = new OrganizationsController(service);

    const dto = await controller.getById(org.id);

    expect(service.getById).toHaveBeenCalledWith(org.id);
    expect(dto.id).toBe(org.id);
  });

  it("updateStatus delegates the active flag", async () => {
    const service = { setActive: jest.fn().mockResolvedValue(org) } as unknown as OrganizationService;
    const controller = new OrganizationsController(service);

    await controller.updateStatus(org.id, { active: false });

    expect(service.setActive).toHaveBeenCalledWith(org.id, false);
  });
});
