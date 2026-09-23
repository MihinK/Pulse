import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { MikroOrmModule } from "@mikro-orm/nestjs";
import { SystemClock } from "@pulse/shared";
import { Organization } from "./domain/organization.entity";
import { User } from "./domain/user.entity";
import { Invitation } from "./domain/invitation.entity";
import { RefreshToken } from "./domain/refresh-token.entity";
import { AuthService } from "./application/auth.service";
import { InvitationService } from "./application/invitation.service";
import { OrganizationService } from "./application/organization.service";
import { ProfileService } from "./application/profile.service";
import { MikroOrmOrganizationRepository } from "./infrastructure/mikroorm-organization.repository";
import { MikroOrmUserRepository } from "./infrastructure/mikroorm-user.repository";
import { MikroOrmInvitationRepository } from "./infrastructure/mikroorm-invitation.repository";
import { MikroOrmRefreshTokenRepository } from "./infrastructure/mikroorm-refresh-token.repository";
import { Argon2PasswordHasher } from "./infrastructure/argon2-password-hasher";
import { JwtTokenService } from "./infrastructure/jwt-token.service";
import { PulseOwnerSeeder } from "./infrastructure/pulse-owner.seeder";
import { AuthController } from "./presentation/auth.controller";
import { OrganizationsController } from "./presentation/organizations.controller";
import { InvitationsController, InvitationAcceptController } from "./presentation/invitations.controller";
import { UsersController, OrganizationUsersController } from "./presentation/users.controller";
import { TOKEN_SERVICE } from "../../common/auth/token-service";
import {
  CLOCK,
  INVITATION_REPOSITORY,
  INVITATION_TTL_MS,
  ORGANIZATION_REPOSITORY,
  PASSWORD_HASHER,
  REFRESH_TOKEN_REPOSITORY,
  REFRESH_TOKEN_TTL_MS,
  USER_REPOSITORY,
} from "./identity.tokens";

const DAY_MS = 24 * 60 * 60 * 1000;

@Module({
  imports: [
    MikroOrmModule.forFeature([Organization, User, Invitation, RefreshToken]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("JWT_ACCESS_SECRET", "dev-only-insecure-secret"),
        signOptions: {
          expiresIn: Number(config.get<string>("JWT_ACCESS_TTL_SECONDS", "900")),
        },
      }),
    }),
  ],
  controllers: [
    AuthController,
    OrganizationsController,
    InvitationsController,
    InvitationAcceptController,
    UsersController,
    OrganizationUsersController,
  ],
  providers: [
    AuthService,
    InvitationService,
    OrganizationService,
    ProfileService,
    PulseOwnerSeeder,
    { provide: CLOCK, useClass: SystemClock },
    { provide: ORGANIZATION_REPOSITORY, useClass: MikroOrmOrganizationRepository },
    { provide: USER_REPOSITORY, useClass: MikroOrmUserRepository },
    { provide: INVITATION_REPOSITORY, useClass: MikroOrmInvitationRepository },
    { provide: REFRESH_TOKEN_REPOSITORY, useClass: MikroOrmRefreshTokenRepository },
    { provide: PASSWORD_HASHER, useClass: Argon2PasswordHasher },
    { provide: TOKEN_SERVICE, useClass: JwtTokenService },
    {
      provide: REFRESH_TOKEN_TTL_MS,
      useFactory: (config: ConfigService) =>
        Number(config.get<string>("REFRESH_TOKEN_TTL_MS", String(30 * DAY_MS))),
      inject: [ConfigService],
    },
    {
      provide: INVITATION_TTL_MS,
      useFactory: (config: ConfigService) =>
        Number(config.get<string>("INVITATION_TTL_MS", String(7 * DAY_MS))),
      inject: [ConfigService],
    },
  ],
  // TOKEN_SERVICE is exported so the globally-registered JwtAuthGuard (in AppModule) can inject
  // it; the RLS-facing EntityManager is exported implicitly by MikroOrmModule.forRoot in
  // AppModule, which TenancyInterceptor (also global) depends on directly. OrganizationService
  // and ProfileService are exported so `applications` module controllers can resolve the acting
  // Organization/User entities from a principal without reaching into identity's repositories
  // directly — the same encapsulation boundary `refresh_tokens`' RLS policy draws at the SQL
  // level (transitively through `users`, never touched directly by another module).
  exports: [TOKEN_SERVICE, OrganizationService, ProfileService],
})
export class IdentityModule {}
