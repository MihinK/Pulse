import type { INestApplication } from "@nestjs/common";
import type { Server } from "node:http";
import request from "supertest";
import { startTestDatabase, type TestDatabase } from "./support/postgres-test-db";
import { startTestRedis, type TestRedis } from "./support/redis-test-db";
import { createTestApp } from "./support/test-app";

interface SessionBody {
  accessToken: string;
  organizationId: string | null;
}

/**
 * The sprint's literal "done when" criterion (technical plan section 9, sprint 2): "Two orgs
 * cannot see each other's data." Runs against a real Postgres (Testcontainers) connected as the
 * unprivileged `pulse_app` role, so it proves the RLS policies from ADR-003 themselves, not just
 * the application code that happens to add the right `WHERE` clauses.
 */
describe("Tenancy — cross-organisation isolation (e2e)", () => {
  let db: TestDatabase;
  let redis: TestRedis;
  let app: INestApplication;
  let server: Server;

  const platformOwner = { email: "owner@pulse.test", password: "owner-password-123" };

  beforeAll(async () => {
    db = await startTestDatabase();
    redis = await startTestRedis();
    process.env.JWT_ACCESS_SECRET = "test-secret";
    process.env.PLATFORM_OWNER_EMAIL = platformOwner.email;
    process.env.PLATFORM_OWNER_PASSWORD = platformOwner.password;

    app = await createTestApp();
    server = app.getHttpServer() as Server;
  }, 120_000);

  afterAll(async () => {
    await app.close();
    await db.stop();
    await redis.stop();
  }, 60_000);

  async function loginAs(email: string, password: string): Promise<string> {
    const response = await request(server)
      .post("/api/v1/auth/login")
      .send({ email, password })
      .expect(200);
    return (response.body as SessionBody).accessToken;
  }

  async function createOrg(ownerToken: string, slug: string): Promise<string> {
    const response = await request(server)
      .post("/api/v1/organizations")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: slug, slug, defaultTimeZone: "UTC" })
      .expect(201);
    return (response.body as { id: string }).id;
  }

  async function inviteAndAccept(
    ownerToken: string,
    organizationId: string,
    email: string,
    password: string,
  ): Promise<string> {
    const invite = await request(server)
      .post(`/api/v1/organizations/${organizationId}/invitations`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ email, role: "ADMIN" })
      .expect(201);
    const rawToken = (invite.body as { link: string }).link.split("/").pop() as string;

    const accept = await request(server)
      .post(`/api/v1/invitations/${rawToken}/accept`)
      .send({ password })
      .expect(200);
    return (accept.body as SessionBody).accessToken;
  }

  it("keeps every org's data invisible to another org's admin", async () => {
    const ownerToken = await loginAs(platformOwner.email, platformOwner.password);
    const orgAId = await createOrg(ownerToken, "org-a");
    const orgBId = await createOrg(ownerToken, "org-b");

    const adminAToken = await inviteAndAccept(
      ownerToken,
      orgAId,
      "admin@a.test",
      "admin-a-password",
    );
    await inviteAndAccept(ownerToken, orgBId, "admin@b.test", "admin-b-password");

    // Org A's admin can see their own org and its (one) user.
    await request(server)
      .get(`/api/v1/organizations/${orgAId}`)
      .set("Authorization", `Bearer ${adminAToken}`)
      .expect(200);
    const ownUsers = await request(server)
      .get(`/api/v1/organizations/${orgAId}/users`)
      .set("Authorization", `Bearer ${adminAToken}`)
      .expect(200);
    expect((ownUsers.body as unknown[])).toHaveLength(1);

    // Org B is invisible to org A's admin — 404, not an empty result, not 403 (which would
    // confirm org B *exists*).
    await request(server)
      .get(`/api/v1/organizations/${orgBId}`)
      .set("Authorization", `Bearer ${adminAToken}`)
      .expect(404);
    await request(server)
      .get(`/api/v1/organizations/${orgBId}/users`)
      .set("Authorization", `Bearer ${adminAToken}`)
      .expect(404);
  });

  it("lets the Platform Owner see every organisation", async () => {
    const ownerToken = await loginAs(platformOwner.email, platformOwner.password);

    const response = await request(server)
      .get("/api/v1/organizations")
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200);

    const slugs = (response.body as Array<{ slug: string }>).map((org) => org.slug);
    expect(slugs).toEqual(expect.arrayContaining(["org-a", "org-b"]));
  });
});
