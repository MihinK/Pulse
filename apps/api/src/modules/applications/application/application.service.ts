import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Organization } from "../../identity/domain/organization.entity";
import { User } from "../../identity/domain/user.entity";
import { Application } from "../domain/application.entity";
import { AuthConfig } from "../domain/auth-config.entity";
import { AuthType } from "../domain/auth-type.enum";
import { AuditLog } from "../domain/audit-log.entity";
import { Environment } from "../domain/environment.enum";
import {
  APPLICATION_REPOSITORY,
  AUTH_CONFIG_REPOSITORY,
  AUDIT_LOG_REPOSITORY,
} from "../applications.tokens";
import type { ApplicationFilter, ApplicationRepository } from "./ports/application-repository";
import type { AuthConfigRepository } from "./ports/auth-config-repository";
import type { AuditLogRepository } from "./ports/audit-log-repository";
import { RunService } from "./run.service";

export interface CreateApplicationInput {
  name: string;
  baseUrl: string;
  environment: Environment;
  description?: string;
  tags?: string[];
  checkIntervalMinutes?: number;
  timeoutMs?: number;
  slowThresholdMs?: number;
}

export interface UpdateApplicationInput {
  name?: string;
  baseUrl?: string;
  environment?: Environment;
  description?: string;
  tags?: string[];
  checkIntervalMinutes?: number;
  timeoutMs?: number;
  slowThresholdMs?: number;
  expectedStatuses?: number[] | null;
  schemaValidation?: boolean;
}

/**
 * `create()` matches the data model's transaction-boundary table for "Add application" exactly
 * (FR-APP-06: the first check): application + default auth config (NONE) + a QUEUED check run +
 * its outbox entry + an audit log entry, all in the one transaction `TenancyInterceptor` already
 * opened for this request (ADR-002's "one flush per business operation" — no manual transaction
 * wrapping needed here).
 */
@Injectable()
export class ApplicationService {
  public constructor(
    @Inject(APPLICATION_REPOSITORY) private readonly applications: ApplicationRepository,
    @Inject(AUTH_CONFIG_REPOSITORY) private readonly authConfigs: AuthConfigRepository,
    @Inject(AUDIT_LOG_REPOSITORY) private readonly auditLogs: AuditLogRepository,
    private readonly runs: RunService,
  ) {}

  public async create(
    organization: Organization,
    actor: User,
    input: CreateApplicationInput,
  ): Promise<Application> {
    const application = new Application(organization, input.name, input.baseUrl, input.environment);
    application.update({
      description: input.description,
      tags: input.tags,
      checkIntervalMinutes: input.checkIntervalMinutes,
      timeoutMs: input.timeoutMs,
      slowThresholdMs: input.slowThresholdMs,
    });
    await this.applications.save(application);

    await this.authConfigs.save(new AuthConfig(application, AuthType.NONE));

    await this.runs.startManualRun(organization, application, actor);

    await this.auditLogs.save(
      new AuditLog(organization, actor, "application.created", "Application", application.id, {
        after: { name: application.name, baseUrl: application.baseUrl, environment: application.environment },
      }),
    );

    return application;
  }

  public async list(filter?: ApplicationFilter): Promise<Application[]> {
    return this.applications.findAll(filter);
  }

  public async getById(id: string): Promise<Application> {
    const application = await this.applications.findById(id);
    if (!application || application.isDeleted()) {
      throw new NotFoundException("Application not found");
    }
    return application;
  }

  public async update(id: string, input: UpdateApplicationInput): Promise<Application> {
    const application = await this.getById(id);
    application.update(input);
    await this.applications.save(application);
    return application;
  }

  public async softDelete(id: string): Promise<void> {
    const application = await this.getById(id);
    application.softDelete();
    await this.applications.save(application);
  }
}
