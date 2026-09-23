import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue as BullQueue } from "bullmq";
import type { Queue } from "../application/ports/queue";
import { CHECK_RUNS_QUEUE } from "./queue.constants";

@Injectable()
export class BullMqQueue implements Queue {
  public constructor(@InjectQueue(CHECK_RUNS_QUEUE) private readonly queue: BullQueue) {}

  public async enqueue(kind: string, payload: Record<string, unknown>): Promise<void> {
    await this.queue.add(kind, payload);
  }
}
