import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue as BullQueue } from "bullmq";
import type { Queue } from "../application/ports/queue";
import { DOCUMENT_PARSING_QUEUE } from "./queue.constants";

@Injectable()
export class BullMqDocumentQueue implements Queue {
  public constructor(@InjectQueue(DOCUMENT_PARSING_QUEUE) private readonly queue: BullQueue) {}

  public async enqueue(kind: string, payload: Record<string, unknown>): Promise<void> {
    await this.queue.add(kind, payload);
  }
}
