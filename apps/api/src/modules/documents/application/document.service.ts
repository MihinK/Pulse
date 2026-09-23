import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import { v7 as uuidv7 } from "uuid";
import { Application } from "../../applications/domain/application.entity";
import { User } from "../../identity/domain/user.entity";
import { OutboxEntry } from "../../applications/domain/outbox-entry.entity";
import { OUTBOX_REPOSITORY } from "../../applications/applications.tokens";
import type { OutboxRepository } from "../../applications/application/ports/outbox-repository";
import { ApiDocument } from "../domain/api-document.entity";
import { DOCUMENT_UPLOADED_KIND } from "../domain/outbox-kinds";
import {
  API_DOCUMENT_REPOSITORY,
  CONTENT_FETCHER,
  MAX_UPLOAD_BYTES,
  OBJECT_STORAGE,
  SPEC_FORMAT_DETECTOR,
} from "../documents.tokens";
import type { ApiDocumentRepository } from "./ports/api-document-repository";
import type { ObjectStorage } from "./ports/object-storage";
import type { SpecFormatDetector } from "./ports/spec-format-detector";
import type { ContentFetcher } from "./ports/content-fetcher";

/**
 * The spec parsing pipeline's synchronous half (technical plan section 4.4, steps 1-2's
 * "detect"): store the raw upload, checksum it, detect its format, and hand off to the worker
 * for the expensive/risky half (validate, dereference, normalise, carry over — step 2's
 * "validate" onward). Matches `ApplicationService.create`'s shape: persist + an outbox row, one
 * transaction (`TenancyInterceptor` already opened it), no manual transaction wrapping.
 */
@Injectable()
export class DocumentService {
  public constructor(
    @Inject(API_DOCUMENT_REPOSITORY) private readonly apiDocuments: ApiDocumentRepository,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    @Inject(SPEC_FORMAT_DETECTOR) private readonly formatDetector: SpecFormatDetector,
    @Inject(OUTBOX_REPOSITORY) private readonly outbox: OutboxRepository,
    @Inject(CONTENT_FETCHER) private readonly contentFetcher: ContentFetcher,
  ) {}

  public async uploadFile(application: Application, actor: User, content: Buffer): Promise<ApiDocument> {
    return this.createVersion(application, actor, content);
  }

  public async importFromUrl(application: Application, actor: User, url: string): Promise<ApiDocument> {
    const content = await this.contentFetcher.fetch(url, MAX_UPLOAD_BYTES);
    return this.createVersion(application, actor, content);
  }

  public async listVersions(applicationId: string): Promise<ApiDocument[]> {
    return this.apiDocuments.findByApplicationId(applicationId);
  }

  private async createVersion(application: Application, actor: User, content: Buffer): Promise<ApiDocument> {
    if (content.byteLength > MAX_UPLOAD_BYTES) {
      throw new BadRequestException(`File exceeds the ${MAX_UPLOAD_BYTES} byte limit`);
    }

    const detected = this.formatDetector.detect(content);
    if (!detected) {
      throw new BadRequestException(
        "Unrecognized spec format — expected OpenAPI 3, Swagger 2, or a Postman v2.1 collection",
      );
    }

    const checksum = createHash("sha256").update(content).digest("hex");

    const active = await this.apiDocuments.findActiveByApplicationId(application.id);
    if (active && active.checksum === checksum) {
      return active;
    }

    const previousVersions = await this.apiDocuments.findByApplicationId(application.id);
    const versionNo = previousVersions.reduce((max, doc) => Math.max(max, doc.versionNo), 0) + 1;
    const storageKey = `applications/${application.id}/${uuidv7()}`;
    await this.storage.put(storageKey, content, "application/octet-stream");

    const document = new ApiDocument(application, detected.format, versionNo, storageKey, checksum, actor);
    await this.apiDocuments.save(document);

    await this.outbox.save(
      new OutboxEntry(application.organization, DOCUMENT_UPLOADED_KIND, { apiDocumentId: document.id }),
    );

    return document;
  }
}
