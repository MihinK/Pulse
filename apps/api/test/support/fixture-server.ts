import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

export interface FixtureServer {
  baseUrl: string;
  stop(): Promise<void>;
}

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
