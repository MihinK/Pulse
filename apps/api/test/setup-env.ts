/**
 * Runs before Jest even requires the test file (via `setupFiles`), which matters specifically
 * because `AuthController`'s per-route login throttle is a decorator argument — evaluated once,
 * at module-import time, when `AppModule`'s static `import` chain resolves at the top of the test
 * file. Setting these from inside a `beforeAll` (as the Postgres/Redis Testcontainer helpers do)
 * would be too late for that one value; everything else in these suites reads env vars lazily at
 * runtime instead, so this is the one exception.
 */
process.env.THROTTLE_LIMIT ??= "10000";
process.env.LOGIN_THROTTLE_LIMIT ??= "10000";
