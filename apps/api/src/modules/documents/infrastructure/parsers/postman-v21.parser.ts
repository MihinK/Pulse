import { Injectable } from "@nestjs/common";
import Ajv, { type ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
import type { ParsedEndpoint, ParsedSpec } from "../../domain/parsed-spec";
import { SpecParser, SpecValidationError } from "../../application/ports/spec-parser";
import {
  POSTMAN_V21_SCHEMA,
  type PostmanCollection,
  type PostmanItem,
  type PostmanUrl,
} from "./postman-v21.schema";

@Injectable()
export class PostmanV21Parser implements SpecParser {
  private readonly validate: ValidateFunction;

  public constructor() {
    const ajv = new Ajv({ allErrors: true });
    addFormats(ajv);
    this.validate = ajv.compile(POSTMAN_V21_SCHEMA);
  }

  public async parse(document: unknown): Promise<ParsedSpec> {
    if (!this.validate(document)) {
      const message = (this.validate.errors ?? [])
        .map((error) => `${error.instancePath || "/"} ${error.message}`)
        .join("; ");
      throw new SpecValidationError(`Invalid Postman v2.1 collection: ${message}`);
    }

    const collection = document as PostmanCollection;
    const specVersion = extractSpecVersion(collection.info?.schema);
    return Promise.resolve({
      endpoints: walkItems(collection.item ?? []),
      ...(specVersion !== undefined && { specVersion }),
    });
  }
}

function walkItems(items: PostmanItem[]): ParsedEndpoint[] {
  const endpoints: ParsedEndpoint[] = [];
  for (const item of items) {
    if (item.item) {
      endpoints.push(...walkItems(item.item));
      continue;
    }
    if (!item.request) {
      continue;
    }
    const expectedStatuses = extractExpectedStatuses(item.response);
    const sampleParams = extractSampleParams(item.request.url);
    const sampleBody = extractSampleBody(item.request.body);
    endpoints.push({
      method: (item.request.method ?? "GET").toUpperCase(),
      path: extractPath(item.request.url),
      ...(item.name !== undefined && { operationId: item.name }),
      ...(expectedStatuses !== undefined && { expectedStatuses }),
      ...(sampleParams !== undefined && { sampleParams }),
      ...(sampleBody !== undefined && { sampleBody }),
    });
  }
  return endpoints;
}

function extractPath(url: string | PostmanUrl | undefined): string {
  if (typeof url === "string") {
    return pathFromRawUrl(url);
  }
  if (url?.path && url.path.length > 0) {
    return `/${url.path.join("/")}`;
  }
  if (url?.raw) {
    return pathFromRawUrl(url.raw);
  }
  return "/";
}

function pathFromRawUrl(raw: string): string {
  try {
    return new URL(raw).pathname || "/";
  } catch {
    return raw.split("?")[0] || "/";
  }
}

function extractSampleParams(url: string | PostmanUrl | undefined): Record<string, unknown> | undefined {
  if (typeof url === "string" || !url?.query || url.query.length === 0) {
    return undefined;
  }
  const sample: Record<string, unknown> = {};
  for (const entry of url.query) {
    if (entry.key) {
      sample[entry.key] = entry.value ?? "";
    }
  }
  return Object.keys(sample).length > 0 ? sample : undefined;
}

function extractSampleBody(body: { mode?: string; raw?: string } | undefined): Record<string, unknown> | undefined {
  if (!body?.raw || body.raw.trim().length === 0) {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(body.raw);
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

function extractExpectedStatuses(
  responses: { code?: number }[] | undefined,
): number[] | undefined {
  if (!responses || responses.length === 0) {
    return undefined;
  }
  const codes = [...new Set(responses.map((r) => r.code).filter((code): code is number => typeof code === "number"))];
  return codes.length > 0 ? codes : undefined;
}

function extractSpecVersion(schema: string | undefined): string | undefined {
  const match = schema ? /\/collection\/v(\d+\.\d+\.\d+)\//.exec(schema) : null;
  return match ? match[1] : undefined;
}
