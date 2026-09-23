import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseInterceptors,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { AuthService } from "../application/auth.service";
import { LoginDto } from "./dto/login.dto";
import { SessionResponseDto } from "./dto/session-response.dto";
import { Public } from "../../../common/auth/public.decorator";
import { TenancyInterceptor } from "../../../common/auth/tenancy.interceptor";
import { REFRESH_COOKIE_NAME, REFRESH_COOKIE_PATH, extractRefreshCookie, setRefreshCookie } from "./refresh-cookie";

// Brute-force defense on login specifically — read at module-load time (decorator arguments
// can't use Nest's DI/ConfigService) so e2e suites can raise it via `LOGIN_THROTTLE_LIMIT`
// before this module loads; production always gets the secure default of 5.
const LOGIN_THROTTLE_LIMIT = Number(process.env.LOGIN_THROTTLE_LIMIT ?? "5");

@ApiTags("auth")
@Controller("auth")
@UseInterceptors(TenancyInterceptor)
export class AuthController {
  public constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: LOGIN_THROTTLE_LIMIT, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post("login")
  public async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionResponseDto> {
    const session = await this.authService.login(dto.email, dto.password);
    setRefreshCookie(res, session.refreshToken);
    return SessionResponseDto.fromSession(session);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post("refresh")
  public async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionResponseDto> {
    const token = extractRefreshCookie(req);
    if (!token) {
      throw new UnauthorizedException("Missing refresh token");
    }
    const session = await this.authService.refresh(token);
    setRefreshCookie(res, session.refreshToken);
    return SessionResponseDto.fromSession(session);
  }

  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post("logout")
  public async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const token = extractRefreshCookie(req);
    if (token) {
      await this.authService.logout(token);
    }
    res.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
  }
}
