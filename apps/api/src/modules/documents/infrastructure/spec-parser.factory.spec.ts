import { SpecParserFactory } from "./spec-parser.factory";
import { OpenApi3Parser } from "./parsers/openapi3.parser";
import { Swagger2Parser } from "./parsers/swagger2.parser";
import { PostmanV21Parser } from "./parsers/postman-v21.parser";
import { DocumentFormat } from "../domain/document-format.enum";

describe("SpecParserFactory", () => {
  function build() {
    const openApi3Parser = new OpenApi3Parser();
    const swagger2Parser = new Swagger2Parser();
    const postmanV21Parser = new PostmanV21Parser();
    return {
      factory: new SpecParserFactory(openApi3Parser, swagger2Parser, postmanV21Parser),
      openApi3Parser,
      swagger2Parser,
      postmanV21Parser,
    };
  }

  it("returns the OpenAPI 3 parser for OPENAPI_3", () => {
    const { factory, openApi3Parser } = build();
    expect(factory.forFormat(DocumentFormat.OPENAPI_3)).toBe(openApi3Parser);
  });

  it("returns the Swagger 2 parser for SWAGGER_2", () => {
    const { factory, swagger2Parser } = build();
    expect(factory.forFormat(DocumentFormat.SWAGGER_2)).toBe(swagger2Parser);
  });

  it("returns the Postman v2.1 parser for POSTMAN_V21", () => {
    const { factory, postmanV21Parser } = build();
    expect(factory.forFormat(DocumentFormat.POSTMAN_V21)).toBe(postmanV21Parser);
  });
});
