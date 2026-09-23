/**
 * `@nestjs/bullmq` ships ESM-only (no CJS build) — Jest's CommonJS runtime can't `require()` it
 * directly. Unit tests never need its real behavior (decorators are inert metadata outside a full
 * Nest bootstrap); `jest.config.js`'s `moduleNameMapper` redirects the package to this stand-in.
 * Real behavior is exercised by the app actually running (see the sprint 3 manual smoke test) and
 * by Phase 4's Testcontainers suite, which drives the app over HTTP rather than importing these
 * decorators directly.
 */
export function Processor(): ClassDecorator {
  return () => undefined;
}

export abstract class WorkerHost {}

export function InjectQueue(): ParameterDecorator {
  return () => undefined;
}
