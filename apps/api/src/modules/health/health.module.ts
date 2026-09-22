import { Module } from "@nestjs/common";
import { SystemClock } from "@pulse/shared";
import { HealthCheckService } from "./application/health-check.service";
import { DatabaseDependencyCheck } from "./infrastructure/database-dependency-check";
import { HealthController } from "./presentation/health.controller";
import { CLOCK, DEPENDENCY_CHECKS } from "./health.tokens";

@Module({
  controllers: [HealthController],
  providers: [
    HealthCheckService,
    DatabaseDependencyCheck,
    { provide: CLOCK, useClass: SystemClock },
    {
      provide: DEPENDENCY_CHECKS,
      useFactory: (databaseCheck: DatabaseDependencyCheck) => [databaseCheck],
      inject: [DatabaseDependencyCheck],
    },
  ],
})
export class HealthModule {}
