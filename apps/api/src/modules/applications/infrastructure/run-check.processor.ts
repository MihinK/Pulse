import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import { EntityManager } from "@mikro-orm/postgresql";
import { RunCheckService } from "../application/run-check.service";
import { runWithBypassRls } from "./bypass-rls";
import { CHECK_RUNS_QUEUE } from "./queue.constants";

interface RunQueuedPayload {
  checkRunId: string;
}

/**
 * The worker side of the outbox pipeline: `OutboxRelay` enqueues `run.queued` jobs, this consumes
 * them. Runs outside any HTTP request, so it opens its own `bypass_rls` transaction the same way
 * `OutboxRelay` does — there is no `TenancyInterceptor` here either.
 */
@Processor(CHECK_RUNS_QUEUE)
export class RunCheckProcessor extends WorkerHost {
  public constructor(
    private readonly em: EntityManager,
    private readonly runCheckService: RunCheckService,
  ) {
    super();
  }

  public async process(job: Job<RunQueuedPayload>): Promise<void> {
    await runWithBypassRls(this.em, () => this.runCheckService.execute(job.data.checkRunId));
  }
}
