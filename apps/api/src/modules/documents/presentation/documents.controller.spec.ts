import { BadRequestException } from "@nestjs/common";
import { DocumentsController } from "./documents.controller";
import { Organization } from "../../identity/domain/organization.entity";
import { User } from "../../identity/domain/user.entity";
import { Role } from "../../identity/domain/role.enum";
import { Application } from "../../applications/domain/application.entity";
import { Environment } from "../../applications/domain/environment.enum";
import { ApiDocument } from "../domain/api-document.entity";
import { DocumentFormat } from "../domain/document-format.enum";
import type { Principal } from "../../../common/auth/principal";
import type { DocumentService } from "../application/document.service";
import type { ApplicationService } from "../../applications/application/application.service";
import type { ProfileService } from "../../identity/application/profile.service";

describe("DocumentsController", () => {
  const org = new Organization("Acme", "acme", "UTC");
  const admin = new User("admin@acme.test", "hash", Role.ADMIN, org);
  const app = new Application(org, "API", "https://api.acme.test", Environment.PROD);
  const document = new ApiDocument(app, DocumentFormat.OPENAPI_3, 1, "key-1", "sum-1", admin);
  const principal: Principal = { userId: admin.id, organizationId: org.id, role: Role.ADMIN };

  function build() {
    const documents = {
      uploadFile: jest.fn().mockResolvedValue(document),
      importFromUrl: jest.fn().mockResolvedValue(document),
      listVersions: jest.fn().mockResolvedValue([document]),
    } as unknown as jest.Mocked<DocumentService>;
    const applications = {
      getById: jest.fn().mockResolvedValue(app),
    } as unknown as jest.Mocked<ApplicationService>;
    const profile = {
      getSelf: jest.fn().mockResolvedValue(admin),
    } as unknown as jest.Mocked<ProfileService>;
    const controller = new DocumentsController(documents, applications, profile);
    return { controller, documents, applications, profile };
  }

  it("uploads a file when a multipart file part is present", async () => {
    const { controller, documents, applications } = build();
    const file = { buffer: Buffer.from("openapi: 3.0.0") } as Express.Multer.File;

    const dto = await controller.upload(principal, app.id, {}, file);

    expect(applications.getById).toHaveBeenCalledWith(app.id);
    expect(documents.uploadFile).toHaveBeenCalledWith(app, admin, file.buffer);
    expect(dto.id).toBe(document.id);
  });

  it("imports from a URL when no file is given but a url is", async () => {
    const { controller, documents } = build();

    await controller.upload(principal, app.id, { url: "https://example.test/spec.yaml" });

    expect(documents.importFromUrl).toHaveBeenCalledWith(app, admin, "https://example.test/spec.yaml");
  });

  it("rejects the request when neither a file nor a url is given", async () => {
    const { controller } = build();

    await expect(controller.upload(principal, app.id, {})).rejects.toThrow(BadRequestException);
  });

  it("lists versions after confirming the parent application is visible", async () => {
    const { controller, applications, documents } = build();

    const dtos = await controller.list(app.id);

    expect(applications.getById).toHaveBeenCalledWith(app.id);
    expect(documents.listVersions).toHaveBeenCalledWith(app.id);
    expect(dtos).toHaveLength(1);
  });
});
