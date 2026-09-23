import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsUrl } from "class-validator";

/** Body for `POST /applications/:id/documents` when importing from a URL rather than uploading a
 * file — the two share one endpoint, distinguished by whether a `file` part or a `url` field is
 * present (`DocumentsController.upload` picks between them). */
export class ImportDocumentDto {
  @ApiPropertyOptional({ example: "https://api.acme.test/openapi.json" })
  @IsOptional()
  @IsUrl({ require_tld: false })
  public readonly url?: string;
}
