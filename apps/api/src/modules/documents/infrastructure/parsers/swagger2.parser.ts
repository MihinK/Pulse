import { Injectable } from "@nestjs/common";
import SwaggerParser from "@apidevtools/swagger-parser";
import type { OpenAPI, OpenAPIV2 } from "openapi-types";
import type { ParsedEndpoint, ParsedSpec } from "../../domain/parsed-spec";
import { SpecParser, SpecValidationError } from "../../application/ports/spec-parser";
import { assertNoExternalRefs } from "./assert-no-external-refs";

const HTTP_METHODS = ["get", "put", "post", "delete", "options", "head", "patch"] as (keyof OpenAPIV2.PathItemObject)[];

/** Same validate+dereference+normalise shape as `OpenApi3Parser`, but walking Swagger 2's
 * `parameters`/`definitions` shape instead of `requestBody`/`components`. */
@Injectable()
export class Swagger2Parser implements SpecParser {
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

    const doc = dereferenced as OpenAPIV2.Document;
    return {
      endpoints: extractEndpoints(doc),
      specVersion: doc.swagger,
    };
  }
}

function extractEndpoints(doc: OpenAPIV2.Document): ParsedEndpoint[] {
  const endpoints: ParsedEndpoint[] = [];
  for (const [path, pathItem] of Object.entries(doc.paths ?? {})) {
    if (!pathItem) {
      continue;
    }
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method] as OpenAPIV2.OperationObject | undefined;
      if (!operation) {
        continue;
      }
      const expectedStatuses = extractExpectedStatuses(operation.responses);
      const responseSchema = extractResponseSchema(operation.responses);
      const sampleParams = extractSampleParams(operation.parameters);
      const sampleBody = extractSampleBody(operation.parameters);
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
  responses: OpenAPIV2.ResponsesObject | undefined,
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
  responses: OpenAPIV2.ResponsesObject | undefined,
): Record<string, unknown> | undefined {
  if (!responses) {
    return undefined;
  }
  const code = Object.keys(responses).find((key) => /^2\d\d$/.test(key));
  const response = (code ? responses[code] : responses["default"]) as OpenAPIV2.ResponseObject | undefined;
  return isPlainObject(response?.schema) ? response.schema : undefined;
}

function extractSampleParams(
  parameters: (OpenAPIV2.Parameter | OpenAPIV2.ReferenceObject)[] | undefined,
): Record<string, unknown> | undefined {
  if (!parameters || parameters.length === 0) {
    return undefined;
  }
  const sample: Record<string, unknown> = {};
  for (const parameter of parameters as OpenAPIV2.GeneralParameterObject[]) {
    if (parameter.in === "body") {
      continue;
    }
    const example: unknown = (parameter as unknown as Record<string, unknown>)["x-example"] ?? parameter["default"];
    if (example !== undefined && parameter.name) {
      sample[parameter.name] = example;
    }
  }
  return Object.keys(sample).length > 0 ? sample : undefined;
}

function extractSampleBody(
  parameters: (OpenAPIV2.Parameter | OpenAPIV2.ReferenceObject)[] | undefined,
): Record<string, unknown> | undefined {
  const bodyParam = (parameters as OpenAPIV2.InBodyParameterObject[] | undefined)?.find(
    (parameter) => parameter.in === "body",
  );
  const example = (bodyParam?.schema as { example?: unknown } | undefined)?.example;
  return isPlainObject(example) ? example : undefined;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
