import { Test, TestingModuleBuilder } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { AppModule } from "../../src/app.module";
import { configureApp } from "../../src/main";

/**
 * Boots a real Nest app with the exact same middleware/pipes as production (see `main.ts`). The
 * throttle limits are raised (not disabled) in `test/setup-env.ts`, a Jest `setupFiles` script —
 * see its comment for why that has to happen there rather than here.
 *
 * `withBuilder` lets a caller override a provider (`applications-api.e2e-spec.ts` swaps
 * `NETWORK_POLICY` for an always-allow fake in its "positive pipeline" test, so it can point the
 * probe at a local fixture server without also having to defeat the — correctly firing —
 * loopback/private-range SSRF block that real requests would need to clear). This never touches
 * the real `CloudNetworkPolicy`, which stays fully wired (and separately unit-tested) for every
 * other test, including this suite's own SSRF-block assertions.
 */
export async function createTestApp(
  withBuilder?: (builder: TestingModuleBuilder) => TestingModuleBuilder,
): Promise<INestApplication> {
  const builder = Test.createTestingModule({ imports: [AppModule] });
  const moduleFixture = await (withBuilder ? withBuilder(builder) : builder).compile();
  const app = moduleFixture.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}
