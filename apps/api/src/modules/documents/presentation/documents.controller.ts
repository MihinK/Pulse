import { BadRequestException, Body, Controller, Get, Param, Post, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiTags } from "@nestjs/swagger";
import { DocumentService } from "../application/document.service";
import { ApplicationService } from "../../applications/application/application.service";
import { ProfileService } from "../../identity/application/profile.service";
import { CurrentUser } from "../../../common/auth/current-user.decorator";
import { Roles } from "../../../common/auth/roles.decorator";
import { Role } from "../../identity/domain/role.enum";
import type { Principal } from "../../../common/auth/principal";
import { TenancyInterceptor } from "../../../common/auth/tenancy.interceptor";
import { MAX_UPLOAD_BYTES } from "../documents.tokens";
import { ImportDocumentDto } from "./dto/import-document.dto";
import { ApiDocumentResponseDto } from "./dto/api-document-response.dto";

/** `POST` accepts either a multipart `file` part or a JSON/form `url` field — both routes into
 * `DocumentService`'s two upload paths (technical plan 4.4's format-detect-then-checksum flow is
 * identical either way). */
@ApiTags("documents")
@Controller("applications/:applicationId/documents")
@UseInterceptors(TenancyInterceptor)
export class DocumentsController {
  public constructor(
    private readonly documents: DocumentService,
    private readonly applications: ApplicationService,
    private readonly profile: ProfileService,
  ) {}

  @Roles(Role.ADMIN)
  @Post()
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  public async upload(
    @CurrentUser() principal: Principal,
    @Param("applicationId") applicationId: string,
    @Body() dto: ImportDocumentDto,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<ApiDocumentResponseDto> {
    const application = await this.applications.getById(applicationId);
    const actor = await this.profile.getSelf(principal.userId);

    if (file) {
      const document = await this.documents.uploadFile(application, actor, file.buffer);
      return ApiDocumentResponseDto.fromDomain(document);
    }
    if (dto.url) {
      const document = await this.documents.importFromUrl(application, actor, dto.url);
      return ApiDocumentResponseDto.fromDomain(document);
    }
    throw new BadRequestException("Provide either a file upload or a url to import from");
  }

  @Roles(Role.ADMIN, Role.VIEWER)
  @Get()
  public async list(@Param("applicationId") applicationId: string): Promise<ApiDocumentResponseDto[]> {
    await this.applications.getById(applicationId);
    const versions = await this.documents.listVersions(applicationId);
    return versions.map((version) => ApiDocumentResponseDto.fromDomain(version));
  }
}
