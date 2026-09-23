import { Body, Controller, Get, Param, Patch, UseInterceptors } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { EndpointService } from "../application/endpoint.service";
import { Roles } from "../../../common/auth/roles.decorator";
import { Role } from "../../identity/domain/role.enum";
import { TenancyInterceptor } from "../../../common/auth/tenancy.interceptor";
import { PatchEndpointDto } from "./dto/patch-endpoint.dto";
import { EndpointResponseDto } from "./dto/endpoint-response.dto";

/** Split the same way `ApplicationRunsController`/`RunsController` are: this needs the
 * `documentId` path param that `/endpoints/:id` never should. */
@ApiTags("endpoints")
@Controller("documents/:documentId/endpoints")
@UseInterceptors(TenancyInterceptor)
export class DocumentEndpointsController {
  public constructor(private readonly endpoints: EndpointService) {}

  @Roles(Role.ADMIN, Role.VIEWER)
  @Get()
  public async list(@Param("documentId") documentId: string): Promise<EndpointResponseDto[]> {
    const list = await this.endpoints.listByDocument(documentId);
    return list.map((endpoint) => EndpointResponseDto.fromDomain(endpoint));
  }
}

@ApiTags("endpoints")
@Controller("endpoints")
@UseInterceptors(TenancyInterceptor)
export class EndpointsController {
  public constructor(private readonly endpoints: EndpointService) {}

  @Roles(Role.ADMIN)
  @Patch(":id")
  public async patch(
    @Param("id") id: string,
    @Body() dto: PatchEndpointDto,
  ): Promise<EndpointResponseDto> {
    const endpoint = await this.endpoints.patch(id, dto);
    return EndpointResponseDto.fromDomain(endpoint);
  }
}
