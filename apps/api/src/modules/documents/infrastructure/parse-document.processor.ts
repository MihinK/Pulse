import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import { EntityManager } from "@mikro-orm/postgresql";
import { DocumentParseService } from "../application/document-parse.service";
import { runWithBypassRls } from "../../applications/infrastructure/bypass-rls";
import { DOCUMENT_PARSING_QUEUE } from "./queue.constants";

interface DocumentUploadedPayload {
  apiDocumentId: string;
}

/** The worker side of the outbox pipeline: `DocumentOutboxRelay` enqueues `document.uploaded`
 * jobs, this consumes them. Same shape as `RunCheckProcessor` — its own `bypass_rls` transaction
 * since there's no `TenancyInterceptor` outside an HTTP request. */
@Processor(DOCUMENT_PARSING_QUEUE)
export class ParseDocumentProcessor extends WorkerHost {
  public constructor(
    private readonly em: EntityManager,
    private readonly documentParseService: DocumentParseService,
  ) {
    super();
  }

  public async process(job: Job<DocumentUploadedPayload>): Promise<void> {
    await runWithBypassRls(this.em, () => this.documentParseService.execute(job.data.apiDocumentId));
  }
}
