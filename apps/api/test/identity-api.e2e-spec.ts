import type { INestApplication } from "@nestjs/common";
import type { Server } from "node:http";
import request from "supertest";
import { startTestDatabase, type TestDatabase } from "./support/postgres-test-db";
import { startTestRedis, type TestRedis } from "./support/redis-test-db";
import { createTestApp } from "./support/test-app";

interface SessionBody {
  accessToken: string;
}

/**
 * API-level behaviour (technical plan section 8.2, "API: Supertest: every REST endpoint: roles,
 * validation, problem-details errors") that isn't specific to cross-tenant isolation — that's
 * `tenancy.e2e-spec.ts`. Shares the same real-Postgres-via-Testcontainers approach so role checks
 * run through the real RLS-scoped transaction, not a mocked one.
 */
describe("Identity API (e2e)", () => {
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

  describe("login validation and failures", () => {
    it("rejects a malformed email with 400", async () => {
      await request(server)
        .post("/api/v1/auth/login")
        .send({ email: "not-an-email", password: "whatever" })
        .expect(400);
    });

    it("rejects an unknown email with 401", async () => {
      await request(server)
        .post("/api/v1/auth/login")
        .send({ email: "nobody@pulse.test", password: "whatever" })
        .expect(401);
    });

    it("rejects the wrong password with 401", async () => {
      await request(server)
        .post("/api/v1/auth/login")
        .send({ email: platformOwner.email, password: "wrong-password" })
        .expect(401);
    });
  });

  describe("refresh and logout cycle", () => {
    it("rotates the refresh token and invalidates the previous one", async () => {
      const login = await request(server)
        .post("/api/v1/auth/login")
        .send({ email: platformOwner.email, password: platformOwner.password })
        .expect(200);
      const firstCookie = extractRefreshCookie(login);

      const refreshed = await request(server)
        .post("/api/v1/auth/refresh")
        .set("Cookie", firstCookie)
        .expect(200);
      expect(extractRefreshCookie(refreshed)).not.toBe(firstCookie);

      // Reusing the pre-rotation cookie must now fail.
      await request(server)
        .post("/api/v1/auth/refresh")
        .set("Cookie", firstCookie)
        .expect(401);
    });

    it("clears the session on logout, so a further refresh fails", async () => {
      const login = await request(server)
        .post("/api/v1/auth/login")
        .send({ email: platformOwner.email, password: platformOwner.password })
        .expect(200);
      const cookie = extractRefreshCookie(login);

      await request(server).post("/api/v1/auth/logout").set("Cookie", cookie).expect(204);
      await request(server).post("/api/v1/auth/refresh").set("Cookie", cookie).expect(401);
    });

    it("rejects refresh with no cookie at all", async () => {
      await request(server).post("/api/v1/auth/refresh").expect(401);
    });
  });

  describe("role gating", () => {
    it("forbids a non-Platform-Owner from creating an organisation", async () => {
      const ownerToken = await loginAs(platformOwner.email, platformOwner.password);
      const orgResponse = await request(server)
        .post("/api/v1/organizations")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ name: "Role Test Org", slug: "role-test-org", defaultTimeZone: "UTC" })
        .expect(201);
      const orgId = (orgResponse.body as { id: string }).id;

      const invite = await request(server)
        .post(`/api/v1/organizations/${orgId}/invitations`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ email: "viewer@role-test.test", role: "VIEWER" })
        .expect(201);
      const rawToken = (invite.body as { link: string }).link.split("/").pop() as string;
      const accept = await request(server)
        .post(`/api/v1/invitations/${rawToken}/accept`)
        .send({ password: "viewer-password" })
        .expect(200);
      const viewerToken = (accept.body as SessionBody).accessToken;

      await request(server)
        .post("/api/v1/organizations")
        .set("Authorization", `Bearer ${viewerToken}`)
        .send({ name: "Nope", slug: "nope", defaultTimeZone: "UTC" })
        .expect(403);

      await request(server)
        .post(`/api/v1/organizations/${orgId}/invitations`)
        .set("Authorization", `Bearer ${viewerToken}`)
        .send({ email: "someone-else@role-test.test", role: "VIEWER" })
        .expect(403);
    });

    it("requires a bearer token for a protected route", async () => {
      await request(server).get("/api/v1/organizations").expect(401);
    });
  });

  describe("invitations", () => {
    it("404s when accepting a revoked invitation", async () => {
      const ownerToken = await loginAs(platformOwner.email, platformOwner.password);
      const orgResponse = await request(server)
        .post("/api/v1/organizations")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ name: "Revoke Org", slug: "revoke-org", defaultTimeZone: "UTC" })
        .expect(201);
      const orgId = (orgResponse.body as { id: string }).id;

      const invite = await request(server)
        .post(`/api/v1/organizations/${orgId}/invitations`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ email: "revoked@revoke-org.test", role: "VIEWER" })
        .expect(201);
      const invitationId = (invite.body as { id: string }).id;
      const rawToken = (invite.body as { link: string }).link.split("/").pop() as string;

      await request(server)
        .delete(`/api/v1/organizations/${orgId}/invitations/${invitationId}`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .expect(204);

      await request(server)
        .post(`/api/v1/invitations/${rawToken}/accept`)
        .send({ password: "whatever123" })
        .expect(404);
    });

    it("400s when accepting the same invitation twice", async () => {
      const ownerToken = await loginAs(platformOwner.email, platformOwner.password);
      const orgResponse = await request(server)
        .post("/api/v1/organizations")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ name: "Double Accept Org", slug: "double-accept-org", defaultTimeZone: "UTC" })
        .expect(201);
      const orgId = (orgResponse.body as { id: string }).id;

      const invite = await request(server)
        .post(`/api/v1/organizations/${orgId}/invitations`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ email: "twice@double-accept-org.test", role: "VIEWER" })
        .expect(201);
      const rawToken = (invite.body as { link: string }).link.split("/").pop() as string;

      await request(server)
        .post(`/api/v1/invitations/${rawToken}/accept`)
        .send({ password: "whatever123" })
        .expect(200);
      await request(server)
        .post(`/api/v1/invitations/${rawToken}/accept`)
        .send({ password: "whatever123" })
        .expect(400);
    });
  });

  describe("profile", () => {
    it("rejects an invalid time zone with 400", async () => {
      const ownerToken = await loginAs(platformOwner.email, platformOwner.password);

      await request(server)
        .patch("/api/v1/users/me")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ timeZone: "Not/A/Real/Zone" })
        .expect(400);
    });

    it("accepts a valid IANA time zone", async () => {
      const ownerToken = await loginAs(platformOwner.email, platformOwner.password);

      const response = await request(server)
        .patch("/api/v1/users/me")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ timeZone: "America/New_York" })
        .expect(200);

      expect((response.body as { timeZone: string }).timeZone).toBe("America/New_York");
    });
  });
});

function extractRefreshCookie(response: {
  headers: Record<string, string | string[] | undefined>;
}): string {
  const raw = response.headers["set-cookie"];
  const cookies = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const cookie = cookies.find((c) => c.startsWith("pulse_rt="));
  if (!cookie) {
    throw new Error("Expected a pulse_rt Set-Cookie header in the response");
  }
  return cookie.split(";")[0] as string;
}
