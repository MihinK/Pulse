import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import type { Server } from "node:http";
import request from "supertest";
import { AppModule } from "../src/app.module";

interface HealthResponseBody {
  status: "UP" | "DOWN";
  checkedAt: string;
  dependencies: Array<{ name: string; state: "UP" | "DOWN"; detail?: string }>;
}

describe("Health (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /health returns 200 and status UP", async () => {
    const server = app.getHttpServer() as unknown as Server;
    const response = await request(server).get("/health");
    const body = response.body as HealthResponseBody;

    expect(response.status).toBe(200);
    expect(body.status).toBe("UP");
    expect(Array.isArray(body.dependencies)).toBe(true);
  });
});
