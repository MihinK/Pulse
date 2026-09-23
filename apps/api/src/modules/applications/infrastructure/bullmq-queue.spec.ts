import type { Queue as BullQueue } from "bullmq";
import { BullMqQueue } from "./bullmq-queue";

describe("BullMqQueue", () => {
  it("adds a job named after the kind, with the payload as its data", async () => {
    const add = jest.fn().mockResolvedValue(undefined);
    const bullQueue = { add } as unknown as BullQueue;
    const queue = new BullMqQueue(bullQueue);

    await queue.enqueue("run.queued", { checkRunId: "run-1" });

    expect(add).toHaveBeenCalledWith("run.queued", { checkRunId: "run-1" });
  });
});
