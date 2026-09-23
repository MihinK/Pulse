import { assertNoExternalRefs } from "./assert-no-external-refs";
import { SpecValidationError } from "../../application/ports/spec-parser";

describe("assertNoExternalRefs", () => {
  it("allows a document with no $refs", () => {
    expect(() => assertNoExternalRefs({ openapi: "3.0.0", paths: {} })).not.toThrow();
  });

  it("allows internal (same-document) $refs", () => {
    expect(() =>
      assertNoExternalRefs({
        paths: { "/users": { get: { responses: { 200: { $ref: "#/components/responses/Ok" } } } } },
      }),
    ).not.toThrow();
  });

  it("rejects a $ref pointing at another file", () => {
    expect(() =>
      assertNoExternalRefs({ paths: { "/users": { get: { $ref: "./other-file.yaml#/paths/~1users~1get" } } } }),
    ).toThrow(SpecValidationError);
  });

  it("rejects a $ref pointing at a remote URL", () => {
    expect(() =>
      assertNoExternalRefs({ components: { schemas: { User: { $ref: "https://example.test/schema.json" } } } }),
    ).toThrow(SpecValidationError);
  });

  it("finds an external $ref nested arbitrarily deep, including inside arrays", () => {
    expect(() =>
      assertNoExternalRefs({ a: { b: [{ c: { $ref: "external.yaml" } }] } }),
    ).toThrow(SpecValidationError);
  });

  it("tolerates circular object graphs without infinite looping", () => {
    const node: Record<string, unknown> = { name: "self" };
    node["self"] = node;

    expect(() => assertNoExternalRefs(node)).not.toThrow();
  });
});
