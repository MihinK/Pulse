import { Organization } from "../../identity/domain/organization.entity";
import { OutboxEntry } from "./outbox-entry.entity";

describe("OutboxEntry", () => {
  const org = new Organization("Acme", "acme", "UTC");

  it("starts unprocessed", () => {
    const entry = new OutboxEntry(org, "run.queued", { checkRunId: "abc" });

    expect(entry.kind).toBe("run.queued");
    expect(entry.payload).toEqual({ checkRunId: "abc" });
    expect(entry.processedAt).toBeUndefined();
  });

  it("marks itself processed", () => {
    const entry = new OutboxEntry(org, "run.queued", { checkRunId: "abc" });
    const now = new Date();

    entry.markProcessed(now);

    expect(entry.processedAt).toBe(now);
  });
});
