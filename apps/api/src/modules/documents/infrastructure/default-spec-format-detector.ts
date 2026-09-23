import { Injectable } from "@nestjs/common";
import { load } from "js-yaml";
import { DocumentFormat } from "../domain/document-format.enum";
import type { DetectedFormat, SpecFormatDetector } from "../application/ports/spec-format-detector";

/**
 * JSON is valid YAML, so `js-yaml`'s safe-by-default `load()` (technical plan 8's "safe YAML
 * loading") handles both upload shapes with one parser. Format is then decided from top-level
 * keys, not the file extension — an Admin can upload a `.json` OpenAPI file or a `.yaml` one.
 */
@Injectable()
export class DefaultSpecFormatDetector implements SpecFormatDetector {
  public detect(content: Buffer): DetectedFormat | null {
    let parsed: unknown;
    try {
      parsed = load(content.toString("utf8"));
    } catch {
      return null;
    }

    if (parsed === null || typeof parsed !== "object") {
      return null;
    }
    const doc = parsed as Record<string, unknown>;

    if (typeof doc["openapi"] === "string" && doc["openapi"].startsWith("3.")) {
      return { format: DocumentFormat.OPENAPI_3, parsed };
    }
    if (doc["swagger"] === "2.0") {
      return { format: DocumentFormat.SWAGGER_2, parsed };
    }
    const info = doc["info"];
    if (info && typeof info === "object" && typeof (info as Record<string, unknown>)["schema"] === "string") {
      const schema = (info as Record<string, unknown>)["schema"] as string;
      if (schema.includes("schema.getpostman.com") && schema.includes("collection")) {
        return { format: DocumentFormat.POSTMAN_V21, parsed };
      }
    }

    return null;
  }
}
