import { GenericContainer, Wait, type StartedTestContainer } from "testcontainers";

export interface TestMinio {
  container: StartedTestContainer;
  stop(): Promise<void>;
}

const ACCESS_KEY = "pulse";
const SECRET_KEY = "pulse_dev_password";
const BUCKET = "pulse-documents";
const API_PORT = 9000;

/**
 * Starts a throwaway MinIO in Docker and points `STORAGE_*` at it — `quay.io/minio/minio`, the
 * same image `docker-compose.yml` was switched to after Docker Hub stopped serving `minio/minio`
 * (see the RUNBOOK's troubleshooting section). `S3CompatibleStorage.onModuleInit` creates the
 * bucket itself, so this only needs to make the server reachable before the app boots.
 */
export async function startTestMinio(): Promise<TestMinio> {
  const container = await new GenericContainer("quay.io/minio/minio:latest")
    .withExposedPorts(API_PORT)
    .withEnvironment({ MINIO_ROOT_USER: ACCESS_KEY, MINIO_ROOT_PASSWORD: SECRET_KEY })
    .withCommand(["server", "/data"])
    .withWaitStrategy(Wait.forHttp("/minio/health/ready", API_PORT))
    .start();

  process.env.STORAGE_ENDPOINT = container.getHost();
  process.env.STORAGE_PORT = String(container.getMappedPort(API_PORT));
  process.env.STORAGE_USE_SSL = "false";
  process.env.STORAGE_ACCESS_KEY = ACCESS_KEY;
  process.env.STORAGE_SECRET_KEY = SECRET_KEY;
  process.env.STORAGE_BUCKET = BUCKET;

  return {
    container,
    stop: async () => {
      await container.stop();
    },
  };
}
