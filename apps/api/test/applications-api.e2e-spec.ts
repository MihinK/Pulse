import type { INestApplication } from "@nestjs/common";
import type { Server } from "node:http";
import request from "supertest";
import { startTestDatabase, type TestDatabase } from "./support/postgres-test-db";
import { startTestRedis, type TestRedis } from "./support/redis-test-db";
import { startTestMinio, type TestMinio } from "./support/minio-test-storage";
import { startFixtureServer, type FixtureServer } from "./support/fixture-server";
import { createTestApp } from "./support/test-app";
import { NETWORK_POLICY } from "../src/modules/applications/applications.tokens";
import type { NetworkPolicy } from "../src/modules/applications/application/ports/network-policy";

/**
 * Lets the "positive pipeline" tests below point at the local fixture server (127.0.0.1) without
 * also having to defeat the — correctly firing — loopback/private-range SSRF block a real request
 * to that address would hit. `CloudNetworkPolicy` itself stays wired for every other test in this
 * suite, including the SSRF-block assertion, and is separately unit-tested in isolation.
 */
class AllowAllNetworkPolicy implements NetworkPolicy {
  public assertAllowed(): void {
    // intentionally permissive — see class comment
  }
}

interface SessionBody {
  accessToken: string;
}

interface ApplicationBody {
  id: string;
  status: string;
}

interface CheckRunBody {
  id: string;
  status: string;
  passed: number;
  failed: number;
}

interface OrgAdmin {
  orgId: string;
  adminToken: string;
}

/**
 * FR-APP-06's literal "done when" criterion (technical plan section 9, sprint 3): "Add an app and
 * see UP/DOWN with response time." Runs the whole real pipeline — Postgres (RLS), Redis (BullMQ),
 * the outbox relay, and the worker — against a local fixture server, never the internet.
 */
describe("Applications API (e2e)", () => {
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
  }, 120_000);

  afterAll(async () => {
    await app.close();
    await fixture.stop();
    await db.stop();
    await redis.stop();
    await minio.stop();
  }, 60_000);

  async function loginAs(email: string, password: string): Promise<string> {
    const response = await request(server)
      .post("/api/v1/auth/login")
      .send({ email, password })
      .expect(200);
    return (response.body as SessionBody).accessToken;
  }

  let orgCounter = 0;

  async function createOrgWithAdmin(): Promise<OrgAdmin> {
    orgCounter += 1;
    const slug = `pipeline-org-${orgCounter}`;
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

  async function waitForRunToFinish(token: string, runId: string): Promise<CheckRunBody> {
    for (let attempt = 0; attempt < 30; attempt++) {
      const response = await request(server)
        .get(`/api/v1/runs/${runId}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);
      const run = response.body as CheckRunBody;
      if (run.status === "COMPLETED" || run.status === "FAILED") {
        return run;
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    throw new Error("Run did not finish in time");
  }

  it("creates an application, runs the first check via the real outbox/queue pipeline, and reaches UP", async () => {
    const { adminToken } = await createOrgWithAdmin();

    const created = await request(server)
      .post("/api/v1/applications")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Fixture App", baseUrl: fixture.baseUrl, environment: "PROD" })
      .expect(201);
    const application = created.body as ApplicationBody;
    expect(application.status).toBe("UNKNOWN");

    const runsResponse = await request(server)
      .get(`/api/v1/applications/${application.id}/runs`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    const [firstRun] = runsResponse.body as CheckRunBody[];
    const finished = await waitForRunToFinish(adminToken, (firstRun as CheckRunBody).id);

    expect(finished.status).toBe("COMPLETED");
    expect(finished.passed).toBe(1);
    expect(finished.failed).toBe(0);

    const resultsResponse = await request(server)
      .get(`/api/v1/runs/${finished.id}/results`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    const [result] = resultsResponse.body as Array<{ outcome: string; statusCode: number; responseMs: number }>;
    expect(result).toMatchObject({ outcome: "PASSED", statusCode: 200 });
    expect(result?.responseMs).toBeGreaterThanOrEqual(0);

    const appResponse = await request(server)
      .get(`/api/v1/applications/${application.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect((appResponse.body as ApplicationBody).status).toBe("UP");
  }, 30_000);

  it("marks the application DEGRADED when the response is slower than its threshold", async () => {
    const { adminToken } = await createOrgWithAdmin();
    const created = await request(server)
      .post("/api/v1/applications")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Slow App",
        baseUrl: `${fixture.baseUrl}/slow`,
        environment: "PROD",
        slowThresholdMs: 50,
      })
      .expect(201);
    const application = created.body as ApplicationBody;

    const run = await request(server)
      .post(`/api/v1/applications/${application.id}/runs`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(201);
    const finished = await waitForRunToFinish(adminToken, (run.body as CheckRunBody).id);

    expect(finished.passed).toBe(1);
    const appResponse = await request(server)
      .get(`/api/v1/applications/${application.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect((appResponse.body as ApplicationBody).status).toBe("DEGRADED");
  }, 30_000);

  it("marks the run FAILED and the application DOWN for a non-2xx/3xx response", async () => {
    const { adminToken } = await createOrgWithAdmin();
    const created = await request(server)
      .post("/api/v1/applications")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Erroring App", baseUrl: `${fixture.baseUrl}/error`, environment: "PROD" })
      .expect(201);
    const application = created.body as ApplicationBody;

    const runsResponse = await request(server)
      .get(`/api/v1/applications/${application.id}/runs`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    const [firstRun] = runsResponse.body as CheckRunBody[];
    const finished = await waitForRunToFinish(adminToken, (firstRun as CheckRunBody).id);

    expect(finished.failed).toBe(1);
    const appResponse = await request(server)
      .get(`/api/v1/applications/${application.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect((appResponse.body as ApplicationBody).status).toBe("DOWN");
  }, 30_000);

  it("cross-org isolation: an application is invisible to another org's admin (404, not empty)", async () => {
    const orgA = await createOrgWithAdmin();
    const orgB = await createOrgWithAdmin();

    const created = await request(server)
      .post("/api/v1/applications")
      .set("Authorization", `Bearer ${orgA.adminToken}`)
      .send({ name: "Org A App", baseUrl: fixture.baseUrl, environment: "PROD" })
      .expect(201);
    const application = created.body as ApplicationBody;

    await request(server)
      .get(`/api/v1/applications/${application.id}`)
      .set("Authorization", `Bearer ${orgB.adminToken}`)
      .expect(404);

    const orgBList = await request(server)
      .get("/api/v1/applications")
      .set("Authorization", `Bearer ${orgB.adminToken}`)
      .expect(200);
    expect(orgBList.body as ApplicationBody[]).toHaveLength(0);
  }, 30_000);

  it("a Viewer can list and trigger runs but not create or edit applications", async () => {
    const { orgId, adminToken } = await createOrgWithAdmin();
    const created = await request(server)
      .post("/api/v1/applications")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Shared App", baseUrl: fixture.baseUrl, environment: "PROD" })
      .expect(201);
    const application = created.body as ApplicationBody;

    const invite = await request(server)
      .post(`/api/v1/organizations/${orgId}/invitations`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ email: "viewer@shared-org.test", role: "VIEWER" })
      .expect(201);
    const rawToken = (invite.body as { link: string }).link.split("/").pop() as string;
    const accept = await request(server)
      .post(`/api/v1/invitations/${rawToken}/accept`)
      .send({ password: "viewer-password-123" })
      .expect(200);
    const viewerToken = (accept.body as SessionBody).accessToken;

    await request(server)
      .post("/api/v1/applications")
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({ name: "Nope", baseUrl: fixture.baseUrl, environment: "PROD" })
      .expect(403);

    await request(server)
      .patch(`/api/v1/applications/${application.id}`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({ name: "Also nope" })
      .expect(403);

    await request(server)
      .get("/api/v1/applications")
      .set("Authorization", `Bearer ${viewerToken}`)
      .expect(200);

    await request(server)
      .post(`/api/v1/applications/${application.id}/runs`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .expect(201);
  }, 30_000);
});
