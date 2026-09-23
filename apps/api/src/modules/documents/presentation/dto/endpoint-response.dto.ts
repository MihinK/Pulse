import { ApiProperty } from "@nestjs/swagger";
import type { Endpoint } from "../../domain/endpoint.entity";

export class EndpointResponseDto {
  @ApiProperty()
  public readonly id!: string;

  @ApiProperty()
  public readonly apiDocumentId!: string;

  @ApiProperty()
  public readonly method!: string;

  @ApiProperty()
  public readonly path!: string;

  @ApiProperty({ required: false })
  public readonly operationId?: string;

  @ApiProperty({ type: [Number], required: false })
  public readonly expectedStatuses?: number[];

  @ApiProperty({ required: false, type: Object })
  public readonly responseSchema?: Record<string, unknown>;

  @ApiProperty({ required: false, type: Object })
  public readonly sampleParams?: Record<string, unknown>;

  @ApiProperty({ required: false, type: Object })
  public readonly sampleBody?: Record<string, unknown>;

  @ApiProperty()
  public readonly included!: boolean;

  @ApiProperty()
  public readonly writeEnabled!: boolean;

  @ApiProperty()
  public readonly allowInSchedule!: boolean;

  public static fromDomain(endpoint: Endpoint): EndpointResponseDto {
    const dto = new EndpointResponseDto();
    const target = dto as {
      id: string;
      apiDocumentId: string;
      method: string;
      path: string;
      operationId?: string;
      expectedStatuses?: number[];
      responseSchema?: Record<string, unknown>;
      sampleParams?: Record<string, unknown>;
      sampleBody?: Record<string, unknown>;
      included: boolean;
      writeEnabled: boolean;
      allowInSchedule: boolean;
    };
    target.id = endpoint.id;
    target.apiDocumentId = endpoint.apiDocument.id;
    target.method = endpoint.method;
    target.path = endpoint.path;
    // MikroORM hydrates a NULL column as `null`, not `undefined` — loose `!= null` catches both.
    if (endpoint.operationId != null) target.operationId = endpoint.operationId;
    if (endpoint.expectedStatuses != null) target.expectedStatuses = endpoint.expectedStatuses;
    if (endpoint.responseSchema != null) target.responseSchema = endpoint.responseSchema;
    if (endpoint.sampleParams != null) target.sampleParams = endpoint.sampleParams;
    if (endpoint.sampleBody != null) target.sampleBody = endpoint.sampleBody;
    target.included = endpoint.included;
    target.writeEnabled = endpoint.writeEnabled;
    target.allowInSchedule = endpoint.allowInSchedule;
    return dto;
  }
}
