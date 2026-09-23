import { Injectable } from "@nestjs/common";
import SwaggerParser from "@apidevtools/swagger-parser";
import type { OpenAPI, OpenAPIV3 } from "openapi-types";
import type { ParsedEndpoint, ParsedSpec } from "../../domain/parsed-spec";
import { SpecParser, SpecValidationError } from "../../application/ports/spec-parser";
import { assertNoExternalRefs } from "./assert-no-external-refs";

const HTTP_METHODS: OpenAPIV3.HttpMethods[] = [
  "get",
  "put",
  "post",
  "delete",
  "options",
  "head",
  "patch",
  "trace",
] as OpenAPIV3.HttpMethods[];

/** Validates + dereferences internal `$ref`s only (technical plan 4.4 steps 2-3), then normalises
 * every operation into a `ParsedEndpoint`. */
@Injectable()
export class OpenApi3Parser implements SpecParser {
  public async parse(document: unknown): Promise<ParsedSpec> {
    assertNoExternalRefs(document);

    let dereferenced: OpenAPI.Document;
    try {
      dereferenced = await SwaggerParser.validate(document as OpenAPI.Document, {
        resolve: { external: false },
      });
    } catch (error) {
      throw new SpecValidationError(describeError(error));
    }

    const doc = dereferenced as OpenAPIV3.Document;
    return {
      endpoints: extractEndpoints(doc),
      specVersion: doc.openapi,
    };
  }
}

function extractEndpoints(doc: OpenAPIV3.Document): ParsedEndpoint[] {
  const endpoints: ParsedEndpoint[] = [];
  for (const [path, pathItem] of Object.entries(doc.paths ?? {})) {
    if (!pathItem) {
      continue;
    }
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (!operation) {
        continue;
      }
      const expectedStatuses = extractExpectedStatuses(operation.responses);
      const responseSchema = extractResponseSchema(operation.responses);
      const sampleParams = extractSampleParams(operation.parameters);
      const sampleBody = extractSampleBody(operation.requestBody);
      endpoints.push({
        method: method.toUpperCase(),
        path,
        ...(operation.operationId !== undefined && { operationId: operation.operationId }),
        ...(expectedStatuses !== undefined && { expectedStatuses }),
        ...(responseSchema !== undefined && { responseSchema }),
        ...(sampleParams !== undefined && { sampleParams }),
        ...(sampleBody !== undefined && { sampleBody }),
      });
    }
  }
  return endpoints;
}

function extractExpectedStatuses(
  responses: OpenAPIV3.ResponsesObject | undefined,
): number[] | undefined {
  if (!responses) {
    return undefined;
  }
  const statuses = Object.keys(responses)
    .filter((code) => /^[23]\d\d$/.test(code))
    .map(Number);
  return statuses.length > 0 ? statuses : undefined;
}

function extractResponseSchema(
  responses: OpenAPIV3.ResponsesObject | undefined,
): Record<string, unknown> | undefined {
  const success = findSuccessResponse(responses);
  const schema = success?.content?.["application/json"]?.schema;
  return isPlainObject(schema) ? schema : undefined;
}

function findSuccessResponse(
  responses: OpenAPIV3.ResponsesObject | undefined,
): OpenAPIV3.ResponseObject | undefined {
  if (!responses) {
    return undefined;
  }
  const code = Object.keys(responses).find((key) => /^2\d\d$/.test(key));
  const response = code ? responses[code] : responses["default"];
  return response as OpenAPIV3.ResponseObject | undefined;
}

function extractSampleParams(
  parameters: (OpenAPIV3.ParameterObject | OpenAPIV3.ReferenceObject)[] | undefined,
): Record<string, unknown> | undefined {
  if (!parameters || parameters.length === 0) {
    return undefined;
  }
  const sample: Record<string, unknown> = {};
  for (const parameter of parameters as OpenAPIV3.ParameterObject[]) {
    const example: unknown = parameter.example ?? (parameter.schema as OpenAPIV3.SchemaObject | undefined)?.example;
    if (example !== undefined && parameter.name) {
      sample[parameter.name] = example;
    }
  }
  return Object.keys(sample).length > 0 ? sample : undefined;
}

function extractSampleBody(
  requestBody: OpenAPIV3.RequestBodyObject | OpenAPIV3.ReferenceObject | undefined,
): Record<string, unknown> | undefined {
  const jsonContent = (requestBody as OpenAPIV3.RequestBodyObject | undefined)?.content?.["application/json"];
  const example: unknown = jsonContent?.example ?? (jsonContent?.schema as OpenAPIV3.SchemaObject | undefined)?.example;
  return isPlainObject(example) ? example : undefined;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
