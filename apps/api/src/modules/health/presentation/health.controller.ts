import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import { ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { HealthCheckService } from "../application/health-check.service";
import { HealthResponseDto } from "./health-response.dto";
import { Public } from "../../../common/auth/public.decorator";

@ApiTags("health")
@Controller("health")
export class HealthController {
  public constructor(private readonly healthCheckService: HealthCheckService) {}

  // Public: sprint 2 added a global JwtAuthGuard (deny-by-default), but this endpoint is used by
  // infra health checks (load balancers, container orchestrators) that never carry a token.
  @Public()
  @Get()
  @ApiOkResponse({ type: HealthResponseDto, description: "Pulse itself is healthy." })
  @ApiServiceUnavailableResponse({
    type: HealthResponseDto,
    description: "One or more dependencies are down.",
  })
  public async check(@Res({ passthrough: true }) res: Response): Promise<HealthResponseDto> {
    const status = await this.healthCheckService.check();
    res.status(status.isUp() ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return HealthResponseDto.fromDomain(status);
  }
}
