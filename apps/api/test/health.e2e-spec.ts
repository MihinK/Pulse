import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import type { Server } from "node:http";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { startTestDatabase, type TestDatabase } from "./support/postgres-test-db";

interface HealthResponseBody {
  status: "UP" | "DOWN";
  checkedAt: string;
  dependencies: Array<{ name: string; state: "UP" | "DOWN"; detail?: string }>;
}

describe("Health (e2e)", () => {
  let db: TestDatabase;
  let app: INestApplication;

  // Sprint 1's DatabaseDependencyCheck always reported UP as a placeholder; now that MikroORM is
  // wired (sprint 2), booting AppModule at all needs a real Postgres — the health check itself
  // still doesn't touch the database, but Nest can't construct the module graph without one.
  beforeAll(async () => {
    db = await startTestDatabase();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  }, 120_000);

  afterAll(async () => {
    await app.close();
    await db.stop();
  }, 60_000);

  it("GET /health returns 200 and status UP", async () => {
    const server = app.getHttpServer() as Server;
    const response = await request(server).get("/health");
    const body = response.body as HealthResponseBody;

    expect(response.status).toBe(200);
    expect(body.status).toBe("UP");
    expect(Array.isArray(body.dependencies)).toBe(true);
  });
});
