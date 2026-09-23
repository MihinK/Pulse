import { ApiProperty } from "@nestjs/swagger";
import type { Application } from "../../domain/application.entity";
import { Environment } from "../../domain/environment.enum";
import { ApplicationStatus } from "../../domain/application-status.enum";

/** Never includes auth credentials (FR-APP-05) — there is no field for them here at all. */
export class ApplicationResponseDto {
  @ApiProperty()
  public readonly id!: string;

  @ApiProperty()
  public readonly name!: string;

  @ApiProperty()
  public readonly baseUrl!: string;

  @ApiProperty({ enum: Environment })
  public readonly environment!: Environment;

  @ApiProperty({ required: false })
  public readonly description?: string;

  @ApiProperty({ type: [String] })
  public readonly tags!: string[];

  @ApiProperty()
  public readonly checkIntervalMinutes!: number;

  @ApiProperty()
  public readonly timeoutMs!: number;

  @ApiProperty()
  public readonly slowThresholdMs!: number;

  @ApiProperty({ type: [Number], nullable: true })
  public readonly expectedStatuses!: number[] | null;

  @ApiProperty()
  public readonly schemaValidation!: boolean;

  @ApiProperty({ enum: ApplicationStatus })
  public readonly status!: ApplicationStatus;

  @ApiProperty()
  public readonly createdAt!: string;

  public static fromDomain(application: Application): ApplicationResponseDto {
    const dto = new ApplicationResponseDto();
    const target = dto as {
      id: string;
      name: string;
      baseUrl: string;
      environment: Environment;
      description?: string;
      tags: string[];
      checkIntervalMinutes: number;
      timeoutMs: number;
      slowThresholdMs: number;
      expectedStatuses: number[] | null;
      schemaValidation: boolean;
      status: ApplicationStatus;
      createdAt: string;
    };
    target.id = application.id;
    target.name = application.name;
    target.baseUrl = application.baseUrl;
    target.environment = application.environment;
    // MikroORM hydrates a NULL column as `null`, not `undefined` — loose `!= null` catches both
    // so the field is omitted from the response rather than serialized as `"description":null`.
    if (application.description != null) {
      target.description = application.description;
    }
    target.tags = application.tags;
    target.checkIntervalMinutes = application.checkIntervalMinutes;
    target.timeoutMs = application.timeoutMs;
    target.slowThresholdMs = application.slowThresholdMs;
    target.expectedStatuses = application.expectedStatuses ?? null;
    target.schemaValidation = application.schemaValidation;
    target.status = application.status;
    target.createdAt = application.createdAt.toISOString();
    return dto;
  }
}
