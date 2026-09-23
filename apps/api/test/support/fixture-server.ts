import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

export interface FixtureServer {
  baseUrl: string;
  stop(): Promise<void>;
}

/** Served at `/openapi.json` for `documents-api.e2e-spec.ts`'s "import from URL" test — a
 * minimal-but-valid OpenAPI 3 document, never fetched from the real internet. */
export const FIXTURE_OPENAPI_DOC = {
  openapi: "3.0.1",
  info: { title: "Fixture API", version: "1.0.0" },
  paths: {
    "/ping": {
      get: {
        operationId: "ping",
        responses: { "200": { description: "OK" } },
      },
    },
  },
};

/**
 * A tiny local HTTP server standing in for a "target API" — technical plan section 8.2: "Target
 * APIs are simulated by a fixture server... tests never reach the internet." Node's built-in
 * `http` module is enough for the handful of routes this suite needs; no framework dependency.
 */
export async function startFixtureServer(): Promise<FixtureServer> {
  const server: Server = createServer((req, res) => {
    const url = req.url ?? "/";
    if (url === "/slow") {
      setTimeout(() => {
        res.writeHead(200, { "content-type": "text/plain" }).end("slow-ok");
      }, 300);
      return;
    }
    if (url === "/error") {
      res.writeHead(500, { "content-type": "text/plain" }).end("boom");
      return;
    }
    if (url === "/redirect") {
      res.writeHead(302, { location: "/ok" }).end();
      return;
    }
    if (url === "/openapi.json") {
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(FIXTURE_OPENAPI_DOC));
      return;
    }
    res.writeHead(200, { "content-type": "text/plain" }).end("ok");
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    stop: () => new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    }),
  };
}
