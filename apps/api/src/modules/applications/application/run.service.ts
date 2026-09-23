import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Organization } from "../../identity/domain/organization.entity";
import { User } from "../../identity/domain/user.entity";
import { Application } from "../domain/application.entity";
import { CheckRun } from "../domain/check-run.entity";
import { CheckResult } from "../domain/check-result.entity";
import { CheckTrigger } from "../domain/check-trigger.enum";
import { OutboxEntry } from "../domain/outbox-entry.entity";
import { RUN_QUEUED_KIND } from "../domain/outbox-kinds";
import { CHECK_RUN_REPOSITORY, CHECK_RESULT_REPOSITORY, OUTBOX_REPOSITORY } from "../applications.tokens";
import type { CheckRunRepository } from "./ports/check-run-repository";
import type { CheckResultRepository } from "./ports/check-result-repository";
import type { OutboxRepository } from "./ports/outbox-repository";

/**
 * Creates a {@link CheckRun} and its {@link OutboxEntry} together (ADR-002: the outbox row is
 * written in the same DB transaction as the run, so the queue job it announces is never enqueued
 * for a run that got rolled back). Used both by `ApplicationService.create` (FR-APP-06's first
 * check) and by `RunsController`'s "Check now" endpoint, so both call sites stay in sync.
 */
@Injectable()
export class RunService {
  public constructor(
    @Inject(CHECK_RUN_REPOSITORY) private readonly checkRuns: CheckRunRepository,
    @Inject(CHECK_RESULT_REPOSITORY) private readonly checkResults: CheckResultRepository,
    @Inject(OUTBOX_REPOSITORY) private readonly outbox: OutboxRepository,
  ) {}

  public async startManualRun(
    organization: Organization,
    application: Application,
    triggeredBy: User,
  ): Promise<CheckRun> {
    const run = new CheckRun(organization, application, CheckTrigger.MANUAL, triggeredBy);
    await this.checkRuns.save(run);
    await this.outbox.save(new OutboxEntry(organization, RUN_QUEUED_KIND, { checkRunId: run.id }));
    return run;
  }

  public async getRun(id: string): Promise<CheckRun> {
    const run = await this.checkRuns.findById(id);
    if (!run) {
      throw new NotFoundException("Run not found");
    }
    return run;
  }

  public async listForApplication(applicationId: string, limit = 20): Promise<CheckRun[]> {
    return this.checkRuns.findByApplicationId(applicationId, limit);
  }

  public async getResults(runId: string): Promise<CheckResult[]> {
    await this.getRun(runId);
    return this.checkResults.findByCheckRunId(runId);
  }
}
