import type { Queue as BullQueue } from "bullmq";
import { BullMqDocumentQueue } from "./bullmq-document-queue";

describe("BullMqDocumentQueue", () => {
  it("adds a job named after the kind, with the payload as its data", async () => {
    const add = jest.fn().mockResolvedValue(undefined);
    const bullQueue = { add } as unknown as BullQueue;
    const queue = new BullMqDocumentQueue(bullQueue);

    await queue.enqueue("document.uploaded", { apiDocumentId: "doc-1" });

    expect(add).toHaveBeenCalledWith("document.uploaded", { apiDocumentId: "doc-1" });
  });
});
