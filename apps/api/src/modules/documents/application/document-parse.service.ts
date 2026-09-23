import { Inject, Injectable, Logger } from "@nestjs/common";
import { Endpoint } from "../domain/endpoint.entity";
import { SpecValidationError } from "./ports/spec-parser";
import {
  API_DOCUMENT_REPOSITORY,
  ENDPOINT_REPOSITORY,
  OBJECT_STORAGE,
  SPEC_FORMAT_DETECTOR,
} from "../documents.tokens";
import type { ApiDocumentRepository } from "./ports/api-document-repository";
import type { EndpointRepository } from "./ports/endpoint-repository";
import type { ObjectStorage } from "./ports/object-storage";
import type { SpecFormatDetector } from "./ports/spec-format-detector";
import { SpecParserFactory } from "../infrastructure/spec-parser.factory";

/**
 * The spec parsing pipeline's asynchronous half (technical plan 4.4, steps 2-5): validate,
 * dereference, normalise, create `Endpoint` rows, carry over the previous version's setup, then
 * flip `status`. Run by `ParseDocumentProcessor` under its own `bypass_rls` transaction — same
 * relationship as `RunCheckProcessor`/`RunCheckService`. Depends on `SpecParserFactory` directly
 * (an infrastructure class), the same way `RunCheckService` depends on `AuthStrategyFactory` —
 * the factory itself is the seam Open/Closed cares about, not a further port around it.
 */
@Injectable()
export class DocumentParseService {
  private readonly logger = new Logger(DocumentParseService.name);

  public constructor(
    @Inject(API_DOCUMENT_REPOSITORY) private readonly apiDocuments: ApiDocumentRepository,
    @Inject(ENDPOINT_REPOSITORY) private readonly endpoints: EndpointRepository,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    @Inject(SPEC_FORMAT_DETECTOR) private readonly formatDetector: SpecFormatDetector,
    private readonly parsers: SpecParserFactory,
  ) {}

  public async execute(apiDocumentId: string): Promise<void> {
    const document = await this.apiDocuments.findById(apiDocumentId);
    if (!document) {
      return;
    }

    try {
      const content = await this.storage.get(document.storageKey);
      const detected = this.formatDetector.detect(content);
      if (!detected) {
        throw new SpecValidationError(
          "Unrecognized spec format — expected OpenAPI 3, Swagger 2, or a Postman v2.1 collection",
        );
      }

      const parser = this.parsers.forFormat(detected.format);
      const parsedSpec = await parser.parse(detected.parsed);
      const newEndpoints = parsedSpec.endpoints.map((parsed) => new Endpoint(document, parsed));

      const previousActive = await this.apiDocuments.findActiveByApplicationId(document.applicationId());
      if (previousActive && previousActive.id !== document.id) {
        await this.carryOverFromPreviousVersion(previousActive.id, newEndpoints);
      }

      await this.endpoints.saveAll(newEndpoints);

      if (previousActive && previousActive.id !== document.id) {
        previousActive.deactivate();
        await this.apiDocuments.save(previousActive);
      }
      document.activate();
      document.markReady(parsedSpec.specVersion);
      await this.apiDocuments.save(document);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Document ${document.id} failed to parse: ${reason}`);
      document.markFailed(reason);
      await this.apiDocuments.save(document);
    }
  }

  private async carryOverFromPreviousVersion(
    previousDocumentId: string,
    newEndpoints: Endpoint[],
  ): Promise<void> {
    const previousEndpoints = await this.endpoints.findByApiDocumentId(previousDocumentId);
    const byKey = new Map(previousEndpoints.map((endpoint) => [endpointKey(endpoint.method, endpoint.path), endpoint]));
    for (const endpoint of newEndpoints) {
      const previous = byKey.get(endpointKey(endpoint.method, endpoint.path));
      if (previous) {
        endpoint.carryOverFrom(previous);
      }
    }
  }
}

function endpointKey(method: string, path: string): string {
  return `${method.toUpperCase()} ${path}`;
}
