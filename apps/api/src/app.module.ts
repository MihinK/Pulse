import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MikroOrmModule } from "@mikro-orm/nestjs";
import { defineConfig } from "@mikro-orm/postgresql";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { buildMikroOrmOptions } from "./mikro-orm.config";
import { HealthModule } from "./modules/health/health.module";
import { IdentityModule } from "./modules/identity/identity.module";
import { ApplicationsModule } from "./modules/applications/applications.module";
import { JwtAuthGuard } from "./common/auth/jwt-auth.guard";
import { RolesGuard } from "./common/auth/roles.guard";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env"],
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      // Overridable so e2e suites (Testcontainers, real HTTP calls, many requests per run) can
      // raise the limit without touching production defaults — see test/support/test-app.ts.
      useFactory: (config: ConfigService) => [
        {
          ttl: Number(config.get<string>("THROTTLE_TTL_MS", "60000")),
          limit: Number(config.get<string>("THROTTLE_LIMIT", "60")),
        },
      ],
    }),
    MikroOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        defineConfig(
          buildMikroOrmOptions(
            config.get<string>("DB_USER", "pulse_app"),
            config.get<string>("DB_PASSWORD", "pulse_app_dev_password"),
          ),
        ),
    }),
    HealthModule,
    IdentityModule,
    ApplicationsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
