import type { INestApplication } from "@nestjs/common";
import type { Server } from "node:http";
import request from "supertest";
import { startTestDatabase, type TestDatabase } from "./support/postgres-test-db";
import { startTestRedis, type TestRedis } from "./support/redis-test-db";
import { startTestMinio, type TestMinio } from "./support/minio-test-storage";
import { startFixtureServer, type FixtureServer, FIXTURE_OPENAPI_DOC } from "./support/fixture-server";
import { createTestApp } from "./support/test-app";
import { NETWORK_POLICY } from "../src/modules/applications/applications.tokens";
import type { NetworkPolicy } from "../src/modules/applications/application/ports/network-policy";

class AllowAllNetworkPolicy implements NetworkPolicy {
  public assertAllowed(): void {
    // See applications-api.e2e-spec.ts's identical class for why this is safe in tests only.
  }
}

interface SessionBody {
  accessToken: string;
}

interface ApiDocumentBody {
  id: string;
  versionNo: number;
  isActive: boolean;
  status: "PENDING" | "READY" | "FAILED";
  specVersion?: string;
  failureReason?: string;
}

interface EndpointBody {
  id: string;
  method: string;
  path: string;
  included: boolean;
  sampleParams?: Record<string, unknown>;
}

const OPENAPI_V1 = {
  openapi: "3.0.1",
  info: { title: "Doc API", version: "1.0.0" },
  paths: {
    "/users": { get: { operationId: "listUsers", responses: { "200": { description: "OK" } } } },
    "/users/{id}": {
      get: {
        operationId: "getUser",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "OK" } },
      },
    },
  },
};

const OPENAPI_V2 = {
  openapi: "3.0.1",
  info: { title: "Doc API", version: "1.1.0" },
  paths: {
    ...OPENAPI_V1.paths,
    "/orders": {
      post: { operationId: "createOrder", responses: { "201": { description: "Created" } } },
    },
  },
};

const SWAGGER_2_DOC = {
  swagger: "2.0",
  info: { title: "Legacy API", version: "1.0.0" },
  paths: {
    "/widgets": { get: { operationId: "listWidgets", responses: { "200": { description: "OK" } } } },
  },
};

const POSTMAN_COLLECTION = {
  info: { name: "Doc Collection", schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json" },
  item: [
    { name: "List gadgets", request: { method: "GET", url: { raw: "https://api.acme.test/gadgets", path: ["gadgets"] } } },
  ],
};

/**
 * Sprint 4's literal "done when" criterion (technical plan section 9): "Upload any of the 3
 * formats and see the endpoint list." Runs the whole real pipeline — Postgres (RLS), Redis
 * (BullMQ), MinIO (object storage), the document outbox relay, and the parse worker — never the
 * internet (URL import hits the local fixture server, matching applications-api.e2e-spec.ts).
 */
describe("Documents API (e2e)", () => {
  let db: TestDatabase;
  let redis: TestRedis;
  let minio: TestMinio;
  let fixture: FixtureServer;
  let app: INestApplication;
  let server: Server;

  const platformOwner = { email: "owner@pulse.test", password: "owner-password-123" };

  beforeAll(async () => {
    db = await startTestDatabase();
    redis = await startTestRedis();
    minio = await startTestMinio();
    fixture = await startFixtureServer();
    process.env.JWT_ACCESS_SECRET = "test-secret";
    process.env.PLATFORM_OWNER_EMAIL = platformOwner.email;
    process.env.PLATFORM_OWNER_PASSWORD = platformOwner.password;
    process.env.SECRET_ENCRYPTION_KEY = "test-encryption-key";

    app = await createTestApp((builder) =>
      builder.overrideProvider(NETWORK_POLICY).useClass(AllowAllNetworkPolicy),
    );
    server = app.getHttpServer() as Server;
  }, 180_000);

  afterAll(async () => {
    await app.close();
    await fixture.stop();
    await db.stop();
    await redis.stop();
    await minio.stop();
  }, 60_000);

  async function loginAs(email: string, password: string): Promise<string> {
    const response = await request(server).post("/api/v1/auth/login").send({ email, password }).expect(200);
    return (response.body as SessionBody).accessToken;
  }

  let orgCounter = 0;

  async function createOrgWithAdmin(): Promise<{ orgId: string; adminToken: string }> {
    orgCounter += 1;
    const slug = `docs-org-${orgCounter}`;
    const ownerToken = await loginAs(platformOwner.email, platformOwner.password);
    const org = await request(server)
      .post("/api/v1/organizations")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: slug, slug, defaultTimeZone: "UTC" })
      .expect(201);
    const orgId = (org.body as { id: string }).id;

    const invite = await request(server)
      .post(`/api/v1/organizations/${orgId}/invitations`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ email: `admin@${slug}.test`, role: "ADMIN" })
      .expect(201);
    const rawToken = (invite.body as { link: string }).link.split("/").pop() as string;
    const accept = await request(server)
      .post(`/api/v1/invitations/${rawToken}/accept`)
      .send({ password: "admin-password-123" })
      .expect(200);
    return { orgId, adminToken: (accept.body as SessionBody).accessToken };
  }

  async function createApplication(token: string, name: string): Promise<string> {
    const created = await request(server)
      .post("/api/v1/applications")
      .set("Authorization", `Bearer ${token}`)
      .send({ name, baseUrl: fixture.baseUrl, environment: "PROD" })
      .expect(201);
    return (created.body as { id: string }).id;
  }

  async function waitForDocument(
    token: string,
    applicationId: string,
    documentId: string,
  ): Promise<ApiDocumentBody> {
    for (let attempt = 0; attempt < 60; attempt++) {
      const response = await request(server)
        .get(`/api/v1/applications/${applicationId}/documents`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);
      const documents = response.body as ApiDocumentBody[];
      const document = documents.find((doc) => doc.id === documentId);
      if (document && document.status !== "PENDING") {
        return document;
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    throw new Error("Document did not finish parsing in time");
  }

  it("uploads an OpenAPI 3 file, parses it into endpoints, carries over setup on re-upload, and dedupes by checksum", async () => {
    const { adminToken } = await createOrgWithAdmin();
    const applicationId = await createApplication(adminToken, "OpenAPI App");

    const uploaded = await request(server)
      .post(`/api/v1/applications/${applicationId}/documents`)
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("file", Buffer.from(JSON.stringify(OPENAPI_V1)), "openapi.json")
      .expect(201);
    const v1 = uploaded.body as ApiDocumentBody;
    expect(v1.status).toBe("PENDING");
    expect(v1.isActive).toBe(false);

    const v1Ready = await waitForDocument(adminToken, applicationId, v1.id);
    expect(v1Ready.status).toBe("READY");
    expect(v1Ready.isActive).toBe(true);
    expect(v1Ready.specVersion).toBe("3.0.1");

    const endpointsV1 = await request(server)
      .get(`/api/v1/documents/${v1.id}/endpoints`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    const v1Endpoints = endpointsV1.body as EndpointBody[];
    expect(v1Endpoints).toHaveLength(2);
    const getUser = v1Endpoints.find((e) => e.method === "GET" && e.path === "/users/{id}");
    expect(getUser).toBeDefined();

    // Set up this endpoint's include/sample-value state — the next version should carry it over.
    await request(server)
      .patch(`/api/v1/endpoints/${(getUser as EndpointBody).id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ included: false, sampleParams: { id: "42" } })
      .expect(200);

    const reuploaded = await request(server)
      .post(`/api/v1/applications/${applicationId}/documents`)
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("file", Buffer.from(JSON.stringify(OPENAPI_V2)), "openapi.json")
      .expect(201);
    const v2 = reuploaded.body as ApiDocumentBody;
    expect(v2.versionNo).toBe(2);

    const v2Ready = await waitForDocument(adminToken, applicationId, v2.id);
    expect(v2Ready.status).toBe("READY");
    expect(v2Ready.isActive).toBe(true);

    const oldDocResponse = await request(server)
      .get(`/api/v1/applications/${applicationId}/documents`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    const oldDoc = (oldDocResponse.body as ApiDocumentBody[]).find((doc) => doc.id === v1.id);
    expect(oldDoc?.isActive).toBe(false);

    const endpointsV2 = await request(server)
      .get(`/api/v1/documents/${v2.id}/endpoints`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    const v2Endpoints = endpointsV2.body as EndpointBody[];
    expect(v2Endpoints).toHaveLength(3);
    const carriedOver = v2Endpoints.find((e) => e.method === "GET" && e.path === "/users/{id}");
    expect(carriedOver?.included).toBe(false);
    expect(carriedOver?.sampleParams).toEqual({ id: "42" });
    const newEndpoint = v2Endpoints.find((e) => e.method === "POST" && e.path === "/orders");
    expect(newEndpoint?.included).toBe(true);

    // Re-uploading the exact same bytes must not create a third version.
    const dedupeUpload = await request(server)
      .post(`/api/v1/applications/${applicationId}/documents`)
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("file", Buffer.from(JSON.stringify(OPENAPI_V2)), "openapi.json")
      .expect(201);
    expect((dedupeUpload.body as ApiDocumentBody).id).toBe(v2.id);

    const finalList = await request(server)
      .get(`/api/v1/applications/${applicationId}/documents`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(finalList.body as ApiDocumentBody[]).toHaveLength(2);
  }, 60_000);

  it("imports a spec from a URL via the real network-policy-checked fetch path", async () => {
    const { adminToken } = await createOrgWithAdmin();
    const applicationId = await createApplication(adminToken, "URL Import App");

    const imported = await request(server)
      .post(`/api/v1/applications/${applicationId}/documents`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ url: `${fixture.baseUrl}/openapi.json` })
      .expect(201);
    const document = imported.body as ApiDocumentBody;

    const ready = await waitForDocument(adminToken, applicationId, document.id);
    expect(ready.status).toBe("READY");

    const endpointsResponse = await request(server)
      .get(`/api/v1/documents/${document.id}/endpoints`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    const endpoints = endpointsResponse.body as EndpointBody[];
    expect(endpoints).toHaveLength(Object.keys(FIXTURE_OPENAPI_DOC.paths).length);
    expect(endpoints[0]?.path).toBe("/ping");
  }, 30_000);

  it("uploads a Swagger 2 document and a Postman v2.1 collection — the other two supported formats", async () => {
    const { adminToken } = await createOrgWithAdmin();

    const swaggerAppId = await createApplication(adminToken, "Swagger App");
    const swaggerUpload = await request(server)
      .post(`/api/v1/applications/${swaggerAppId}/documents`)
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("file", Buffer.from(JSON.stringify(SWAGGER_2_DOC)), "swagger.json")
      .expect(201);
    const swaggerDoc = swaggerUpload.body as ApiDocumentBody;
    const swaggerReady = await waitForDocument(adminToken, swaggerAppId, swaggerDoc.id);
    expect(swaggerReady.status).toBe("READY");
    expect(swaggerReady.specVersion).toBe("2.0");
    const swaggerEndpoints = await request(server)
      .get(`/api/v1/documents/${swaggerDoc.id}/endpoints`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect((swaggerEndpoints.body as EndpointBody[])[0]?.path).toBe("/widgets");

    const postmanAppId = await createApplication(adminToken, "Postman App");
    const postmanUpload = await request(server)
      .post(`/api/v1/applications/${postmanAppId}/documents`)
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("file", Buffer.from(JSON.stringify(POSTMAN_COLLECTION)), "collection.json")
      .expect(201);
    const postmanDoc = postmanUpload.body as ApiDocumentBody;
    const postmanReady = await waitForDocument(adminToken, postmanAppId, postmanDoc.id);
    expect(postmanReady.status).toBe("READY");
    expect(postmanReady.specVersion).toBe("2.1.0");
    const postmanEndpoints = await request(server)
      .get(`/api/v1/documents/${postmanDoc.id}/endpoints`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect((postmanEndpoints.body as EndpointBody[])[0]?.path).toBe("/gadgets");
  }, 60_000);

  it("marks a malformed document FAILED with a reason, without touching endpoints", async () => {
    const { adminToken } = await createOrgWithAdmin();
    const applicationId = await createApplication(adminToken, "Broken App");

    const uploaded = await request(server)
      .post(`/api/v1/applications/${applicationId}/documents`)
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("file", Buffer.from(JSON.stringify({ openapi: "3.0.1" })), "broken.json")
      .expect(201);
    const document = uploaded.body as ApiDocumentBody;

    const failed = await waitForDocument(adminToken, applicationId, document.id);
    expect(failed.status).toBe("FAILED");
    expect(failed.failureReason).toBeTruthy();
    expect(failed.isActive).toBe(false);

    const endpointsResponse = await request(server)
      .get(`/api/v1/documents/${document.id}/endpoints`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(endpointsResponse.body as EndpointBody[]).toHaveLength(0);
  }, 30_000);

  it("cross-org isolation: another org's admin gets 404, not an empty list, for a document/endpoint id", async () => {
    const orgA = await createOrgWithAdmin();
    const orgB = await createOrgWithAdmin();
    const applicationId = await createApplication(orgA.adminToken, "Org A App");

    const uploaded = await request(server)
      .post(`/api/v1/applications/${applicationId}/documents`)
      .set("Authorization", `Bearer ${orgA.adminToken}`)
      .attach("file", Buffer.from(JSON.stringify(OPENAPI_V1)), "openapi.json")
      .expect(201);
    const document = uploaded.body as ApiDocumentBody;
    await waitForDocument(orgA.adminToken, applicationId, document.id);

    await request(server)
      .get(`/api/v1/applications/${applicationId}/documents`)
      .set("Authorization", `Bearer ${orgB.adminToken}`)
      .expect(404);

    await request(server)
      .get(`/api/v1/documents/${document.id}/endpoints`)
      .set("Authorization", `Bearer ${orgB.adminToken}`)
      .expect(404);
  }, 30_000);
});
