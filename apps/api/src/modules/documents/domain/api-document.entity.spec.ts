import { Organization } from "../../identity/domain/organization.entity";
import { User } from "../../identity/domain/user.entity";
import { Role } from "../../identity/domain/role.enum";
import { Application } from "../../applications/domain/application.entity";
import { Environment } from "../../applications/domain/environment.enum";
import { ApiDocument } from "./api-document.entity";
import { DocumentFormat } from "./document-format.enum";
import { DocumentStatus } from "./document-status.enum";

describe("ApiDocument", () => {
  const org = new Organization("Acme", "acme", "UTC");
  const app = new Application(org, "API", "https://api.acme.test", Environment.PROD);
  const admin = new User("admin@acme.test", "hash", Role.ADMIN, org);

  function build(): ApiDocument {
    return new ApiDocument(app, DocumentFormat.OPENAPI_3, 1, "applications/app-1/doc-1.json", "abc123", admin);
  }

  it("starts inactive, PENDING, and with no spec version yet", () => {
    const doc = build();

    expect(doc.isActive).toBe(false);
    expect(doc.status).toBe(DocumentStatus.PENDING);
    expect(doc.applicationId()).toBe(app.id);
    expect(doc.specVersion).toBeUndefined();
  });

  it("activates and deactivates", () => {
    const doc = build();

    doc.activate();
    expect(doc.isActive).toBe(true);

    doc.deactivate();
    expect(doc.isActive).toBe(false);
  });

  it("marks itself ready, clearing any previous failure reason and recording the spec version", () => {
    const doc = build();
    doc.markFailed("boom");

    doc.markReady("3.0.1");

    expect(doc.status).toBe(DocumentStatus.READY);
    expect(doc.failureReason).toBeUndefined();
    expect(doc.specVersion).toBe("3.0.1");
  });

  it("marks itself failed with a reason", () => {
    const doc = build();

    doc.markFailed("external $ref not allowed");

    expect(doc.status).toBe(DocumentStatus.FAILED);
    expect(doc.failureReason).toBe("external $ref not allowed");
  });
});
