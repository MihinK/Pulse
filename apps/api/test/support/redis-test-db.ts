import { GenericContainer, type StartedTestContainer } from "testcontainers";

export interface TestRedis {
  container: StartedTestContainer;
  stop(): Promise<void>;
}

/**
 * Starts a throwaway Redis in Docker and points `REDIS_HOST`/`REDIS_PORT` at it. Every e2e suite
 * that boots `AppModule` needs this now, not just the applications-focused ones — `AppModule`
 * unconditionally imports `ApplicationsModule`, which registers a BullMQ connection at module
 * init. Without a reachable Redis, the app still boots and serves requests (BullMQ retries
 * connecting in the background), but `app.close()` hangs waiting for that connection to settle,
 * so `afterAll` timeouts are the actual failure mode of skipping this, not a boot-time crash.
 */
export async function startTestRedis(): Promise<TestRedis> {
  const container = await new GenericContainer("redis:7-alpine").withExposedPorts(6379).start();

  process.env.REDIS_HOST = container.getHost();
  process.env.REDIS_PORT = String(container.getMappedPort(6379));

  return {
    container,
    stop: async () => {
      await container.stop();
    },
  };
}
