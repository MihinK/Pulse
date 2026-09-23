import { Injectable } from "@nestjs/common";
import { DocumentFormat } from "../domain/document-format.enum";
import type { SpecParser } from "../application/ports/spec-parser";
import { OpenApi3Parser } from "./parsers/openapi3.parser";
import { Swagger2Parser } from "./parsers/swagger2.parser";
import { PostmanV21Parser } from "./parsers/postman-v21.parser";

/**
 * Picks the concrete {@link SpecParser} for a detected format. Lives in infrastructure, not the
 * application layer, for the same reason `AuthStrategyFactory` does — it's the one place allowed
 * to know every concrete parser implementation; adding a fourth format is a new parser class
 * registered here, not a change to `DocumentParseService` (Open/Closed).
 */
@Injectable()
export class SpecParserFactory {
  public constructor(
    private readonly openApi3Parser: OpenApi3Parser,
    private readonly swagger2Parser: Swagger2Parser,
    private readonly postmanV21Parser: PostmanV21Parser,
  ) {}

  public forFormat(format: DocumentFormat): SpecParser {
    switch (format) {
      case DocumentFormat.OPENAPI_3:
        return this.openApi3Parser;
      case DocumentFormat.SWAGGER_2:
        return this.swagger2Parser;
      case DocumentFormat.POSTMAN_V21:
        return this.postmanV21Parser;
    }
  }
}
