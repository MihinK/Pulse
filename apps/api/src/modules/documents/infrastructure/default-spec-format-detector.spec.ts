import { DefaultSpecFormatDetector } from "./default-spec-format-detector";
import { DocumentFormat } from "../domain/document-format.enum";

describe("DefaultSpecFormatDetector", () => {
  const detector = new DefaultSpecFormatDetector();

  it("detects OpenAPI 3 from a JSON document", () => {
    const result = detector.detect(Buffer.from(JSON.stringify({ openapi: "3.0.1", paths: {} })));

    expect(result?.format).toBe(DocumentFormat.OPENAPI_3);
  });

  it("detects OpenAPI 3 from a YAML document", () => {
    const result = detector.detect(Buffer.from("openapi: 3.1.0\npaths: {}\n"));

    expect(result?.format).toBe(DocumentFormat.OPENAPI_3);
  });

  it("detects Swagger 2", () => {
    const result = detector.detect(Buffer.from(JSON.stringify({ swagger: "2.0", paths: {} })));

    expect(result?.format).toBe(DocumentFormat.SWAGGER_2);
  });

  it("detects a Postman v2.1 collection by its info.schema URL", () => {
    const result = detector.detect(
      Buffer.from(
        JSON.stringify({
          info: { schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json" },
          item: [],
        }),
      ),
    );

    expect(result?.format).toBe(DocumentFormat.POSTMAN_V21);
  });

  it("returns null for malformed content", () => {
    expect(detector.detect(Buffer.from("{ not: valid: yaml: ["))).toBeNull();
  });

  it("returns null for a YAML scalar (not an object)", () => {
    expect(detector.detect(Buffer.from("just a string"))).toBeNull();
  });

  it("returns null when no known format matches", () => {
    expect(detector.detect(Buffer.from(JSON.stringify({ foo: "bar" })))).toBeNull();
  });

  it("returns null for an unrelated schema URL", () => {
    const result = detector.detect(
      Buffer.from(JSON.stringify({ info: { schema: "https://example.test/other-schema.json" } })),
    );

    expect(result).toBeNull();
  });
});
