import { Inject, Injectable } from "@nestjs/common";
import type { Clock } from "@pulse/shared";
import { Outcome } from "@pulse/shared";
import { Application } from "../domain/application.entity";
import { CheckResult } from "../domain/check-result.entity";
import { CheckRun } from "../domain/check-run.entity";
import {
  APPLICATION_REPOSITORY,
  AUTH_CONFIG_REPOSITORY,
  CHECK_RESULT_REPOSITORY,
  CHECK_RUN_REPOSITORY,
  CLOCK,
  HTTP_PROBE,
} from "../applications.tokens";
import type { ApplicationRepository } from "./ports/application-repository";
import type { AuthConfigRepository } from "./ports/auth-config-repository";
import type { CheckResultRepository } from "./ports/check-result-repository";
import type { CheckRunRepository } from "./ports/check-run-repository";
import type { HttpProbe } from "./ports/http-probe";
import { AuthStrategyFactory } from "../infrastructure/auth-strategy.factory";

/**
 * The check execution itself (technical plan section 4.2's flow, minus the endpoint-probe loop —
 * there are no endpoints to loop over until sprint 5's API documents exist). Run by
 * `RunCheckProcessor` under its own `bypass_rls` transaction (a worker has no single organisation
 * in its request context the way an HTTP request does).
 */
@Injectable()
export class RunCheckService {
  public constructor(
    @Inject(CHECK_RUN_REPOSITORY) private readonly checkRuns: CheckRunRepository,
    @Inject(CHECK_RESULT_REPOSITORY) private readonly checkResults: CheckResultRepository,
    @Inject(APPLICATION_REPOSITORY) private readonly applications: ApplicationRepository,
    @Inject(AUTH_CONFIG_REPOSITORY) private readonly authConfigs: AuthConfigRepository,
    @Inject(HTTP_PROBE) private readonly httpProbe: HttpProbe,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly authStrategies: AuthStrategyFactory,
  ) {}

  public async execute(checkRunId: string): Promise<void> {
    const run = await this.checkRuns.findById(checkRunId);
    if (!run) {
      return;
    }

    run.start(this.clock.now());
    await this.checkRuns.save(run);

    try {
      const application = await this.applications.findById(run.application.id);
      if (!application) {
        run.fail(this.clock.now());
        await this.checkRuns.save(run);
        return;
      }

      const result = await this.probeApplication(run, application);
      await this.checkResults.saveAll([result]);

      const isDegraded = result.outcome === Outcome.DEGRADED;
      const isFailed = result.outcome === Outcome.FAILED;
      run.complete(this.clock.now(), {
        total: 1,
        passed: isFailed ? 0 : 1,
        failed: isFailed ? 1 : 0,
        skipped: 0,
        avgMs: result.responseMs,
        p95Ms: result.responseMs,
      });
      await this.checkRuns.save(run);

      application.recordCompletedRun(isFailed, isDegraded);
      await this.applications.save(application);
    } catch (error) {
      run.fail(this.clock.now());
      await this.checkRuns.save(run);
      throw error;
    }
  }

  private async probeApplication(run: CheckRun, application: Application): Promise<CheckResult> {
    const authConfig = await this.authConfigs.findByApplicationId(application.id);
    const strategy = this.authStrategies.build(authConfig);
    const request = strategy.apply({ url: application.baseUrl, headers: {} });

    const probeResult = await this.httpProbe.probe(request.url, {
      method: "GET",
      timeoutMs: application.timeoutMs,
      headers: request.headers,
    });

    if (probeResult.error) {
      return new CheckResult(run, application.baseUrl, Outcome.FAILED, {
        failureReason: probeResult.error,
      });
    }

    const statusCode = probeResult.statusCode;
    const expected = this.isExpectedStatus(statusCode, application.expectedStatuses);
    if (!expected) {
      return new CheckResult(run, application.baseUrl, Outcome.FAILED, {
        statusCode,
        responseMs: probeResult.responseMs,
        failureReason: `Unexpected status ${statusCode ?? "(none)"}`,
      });
    }

    const outcome =
      probeResult.responseMs > application.slowThresholdMs ? Outcome.DEGRADED : Outcome.PASSED;
    return new CheckResult(run, application.baseUrl, outcome, {
      statusCode,
      responseMs: probeResult.responseMs,
    });
  }

  private isExpectedStatus(
    statusCode: number | undefined,
    expectedStatuses: number[] | null | undefined,
  ): boolean {
    if (statusCode === undefined) {
      return false;
    }
    if (expectedStatuses != null && expectedStatuses.length > 0) {
      return expectedStatuses.includes(statusCode);
    }
    return statusCode >= 200 && statusCode < 400;
  }
}
