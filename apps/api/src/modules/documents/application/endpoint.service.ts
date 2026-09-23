import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Endpoint } from "../domain/endpoint.entity";
import { API_DOCUMENT_REPOSITORY, ENDPOINT_REPOSITORY } from "../documents.tokens";
import type { ApiDocumentRepository } from "./ports/api-document-repository";
import type { EndpointRepository } from "./ports/endpoint-repository";

export interface PatchEndpointInput {
  included?: boolean | undefined;
  sampleParams?: Record<string, unknown> | undefined;
  sampleBody?: Record<string, unknown> | undefined;
}

@Injectable()
export class EndpointService {
  public constructor(
    @Inject(ENDPOINT_REPOSITORY) private readonly endpoints: EndpointRepository,
    @Inject(API_DOCUMENT_REPOSITORY) private readonly apiDocuments: ApiDocumentRepository,
  ) {}

  public async listByDocument(apiDocumentId: string): Promise<Endpoint[]> {
    // Same "confirm the parent is visible first" reasoning as `OrganizationUsersController` —
    // without it, a document RLS makes invisible would come back 200 [] instead of 404.
    const document = await this.apiDocuments.findById(apiDocumentId);
    if (!document) {
      throw new NotFoundException("API document not found");
    }
    return this.endpoints.findByApiDocumentId(apiDocumentId);
  }

  public async patch(id: string, changes: PatchEndpointInput): Promise<Endpoint> {
    const endpoint = await this.endpoints.findById(id);
    if (!endpoint) {
      throw new NotFoundException("Endpoint not found");
    }
    if (changes.included !== undefined) {
      endpoint.setIncluded(changes.included);
    }
    if (changes.sampleParams !== undefined || changes.sampleBody !== undefined) {
      endpoint.setSampleValues(
        changes.sampleParams !== undefined ? changes.sampleParams : endpoint.sampleParams,
        changes.sampleBody !== undefined ? changes.sampleBody : endpoint.sampleBody,
      );
    }
    await this.endpoints.save(endpoint);
    return endpoint;
  }
}
