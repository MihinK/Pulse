import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MikroOrmModule } from "@mikro-orm/nestjs";
import { BullModule } from "@nestjs/bullmq";
import { ScheduleModule } from "@nestjs/schedule";
import { SystemClock } from "@pulse/shared";
import { IdentityModule } from "../identity/identity.module";
import { Application } from "./domain/application.entity";
import { AuthConfig } from "./domain/auth-config.entity";
import { CheckRun } from "./domain/check-run.entity";
import { CheckResult } from "./domain/check-result.entity";
import { OutboxEntry } from "./domain/outbox-entry.entity";
import { AuditLog } from "./domain/audit-log.entity";
import { ApplicationService } from "./application/application.service";
import { AuthConfigService } from "./application/auth-config.service";
import { RunService } from "./application/run.service";
import { RunCheckService } from "./application/run-check.service";
import { MikroOrmApplicationRepository } from "./infrastructure/mikroorm-application.repository";
import { MikroOrmAuthConfigRepository } from "./infrastructure/mikroorm-auth-config.repository";
import { MikroOrmCheckRunRepository } from "./infrastructure/mikroorm-check-run.repository";
import { MikroOrmCheckResultRepository } from "./infrastructure/mikroorm-check-result.repository";
import { MikroOrmOutboxRepository } from "./infrastructure/mikroorm-outbox.repository";
import { MikroOrmAuditLogRepository } from "./infrastructure/mikroorm-audit-log.repository";
import { AesGcmSecretCipher } from "./infrastructure/aes-gcm-secret-cipher";
import { CloudNetworkPolicy } from "./infrastructure/cloud-network-policy";
import { UndiciHttpProbe } from "./infrastructure/undici-http-probe";
import { AuthStrategyFactory } from "./infrastructure/auth-strategy.factory";
import { BullMqQueue } from "./infrastructure/bullmq-queue";
import { OutboxRelay } from "./infrastructure/outbox-relay";
import { RunCheckProcessor } from "./infrastructure/run-check.processor";
import { CHECK_RUNS_QUEUE } from "./infrastructure/queue.constants";
import { ApplicationsController } from "./presentation/applications.controller";
import { ApplicationRunsController, RunsController } from "./presentation/runs.controller";
import {
  APPLICATION_REPOSITORY,
  AUDIT_LOG_REPOSITORY,
  AUTH_CONFIG_REPOSITORY,
  CHECK_RESULT_REPOSITORY,
  CHECK_RUN_REPOSITORY,
  CLOCK,
  HTTP_PROBE,
  NETWORK_POLICY,
  OUTBOX_REPOSITORY,
  QUEUE,
  SECRET_CIPHER,
} from "./applications.tokens";

@Module({
  imports: [
    MikroOrmModule.forFeature([Application, AuthConfig, CheckRun, CheckResult, OutboxEntry, AuditLog]),
    IdentityModule,
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>("REDIS_HOST", "localhost"),
          port: Number(config.get<string>("REDIS_PORT", "6379")),
        },
      }),
    }),
    BullModule.registerQueue({ name: CHECK_RUNS_QUEUE }),
  ],
  controllers: [ApplicationsController, ApplicationRunsController, RunsController],
  providers: [
    ApplicationService,
    AuthConfigService,
    RunService,
    RunCheckService,
    AuthStrategyFactory,
    OutboxRelay,
    RunCheckProcessor,
    { provide: CLOCK, useClass: SystemClock },
    { provide: APPLICATION_REPOSITORY, useClass: MikroOrmApplicationRepository },
    { provide: AUTH_CONFIG_REPOSITORY, useClass: MikroOrmAuthConfigRepository },
    { provide: CHECK_RUN_REPOSITORY, useClass: MikroOrmCheckRunRepository },
    { provide: CHECK_RESULT_REPOSITORY, useClass: MikroOrmCheckResultRepository },
    { provide: OUTBOX_REPOSITORY, useClass: MikroOrmOutboxRepository },
    { provide: AUDIT_LOG_REPOSITORY, useClass: MikroOrmAuditLogRepository },
    { provide: NETWORK_POLICY, useClass: CloudNetworkPolicy },
    { provide: HTTP_PROBE, useClass: UndiciHttpProbe },
    { provide: QUEUE, useClass: BullMqQueue },
    {
      provide: SECRET_CIPHER,
      useFactory: (config: ConfigService) =>
        new AesGcmSecretCipher(
          config.get<string>("SECRET_ENCRYPTION_KEY", "dev-only-insecure-encryption-key"),
        ),
      inject: [ConfigService],
    },
  ],
})
export class ApplicationsModule {}
