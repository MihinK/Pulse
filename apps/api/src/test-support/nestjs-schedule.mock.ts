/** See `nestjs-bullmq.mock.ts` — same ESM-only problem, same fix. */
export function Interval(): MethodDecorator {
  return () => undefined;
}
