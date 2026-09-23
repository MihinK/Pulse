import { Module } from "@nestjs/common";
import { MikroOrmModule } from "@mikro-orm/nestjs";
import { BullModule } from "@nestjs/bullmq";
import { ApplicationsModule } from "../applications/applications.module";
import { IdentityModule } from "../identity/identity.module";
import { ApiDocument } from "./domain/api-document.entity";
import { Endpoint } from "./domain/endpoint.entity";
import { DocumentService } from "./application/document.service";
import { EndpointService } from "./application/endpoint.service";
import { DocumentParseService } from "./application/document-parse.service";
import { MikroOrmApiDocumentRepository } from "./infrastructure/mikroorm-api-document.repository";
import { MikroOrmEndpointRepository } from "./infrastructure/mikroorm-endpoint.repository";
import { DefaultSpecFormatDetector } from "./infrastructure/default-spec-format-detector";
import { S3CompatibleStorage } from "./infrastructure/s3-compatible-storage";
import { UndiciContentFetcher } from "./infrastructure/undici-content-fetcher";
import { SpecParserFactory } from "./infrastructure/spec-parser.factory";
import { OpenApi3Parser } from "./infrastructure/parsers/openapi3.parser";
import { Swagger2Parser } from "./infrastructure/parsers/swagger2.parser";
import { PostmanV21Parser } from "./infrastructure/parsers/postman-v21.parser";
import { BullMqDocumentQueue } from "./infrastructure/bullmq-document-queue";
import { DocumentOutboxRelay } from "./infrastructure/outbox-relay";
import { ParseDocumentProcessor } from "./infrastructure/parse-document.processor";
import { DOCUMENT_PARSING_QUEUE } from "./infrastructure/queue.constants";
import { DocumentsController } from "./presentation/documents.controller";
import { DocumentEndpointsController, EndpointsController } from "./presentation/endpoints.controller";
import {
  API_DOCUMENT_REPOSITORY,
  CONTENT_FETCHER,
  ENDPOINT_REPOSITORY,
  OBJECT_STORAGE,
  QUEUE,
  SPEC_FORMAT_DETECTOR,
} from "./documents.tokens";

@Module({
  imports: [
    MikroOrmModule.forFeature([ApiDocument, Endpoint]),
    // Reuses `ApplicationService` (the "confirm the parent is visible" 404-not-403 pattern),
    // `OUTBOX_REPOSITORY` (ADR-002's shared outbox table), and `NETWORK_POLICY` (URL-import SSRF
    // defense) — see ApplicationsModule's own comment on why these three are exported.
    ApplicationsModule,
    IdentityModule,
    // Connection config is registered once, in AppModule; ScheduleModule.forRoot() (needed for
    // DocumentOutboxRelay's @Interval) is already global via ApplicationsModule's import.
    BullModule.registerQueue({ name: DOCUMENT_PARSING_QUEUE }),
  ],
  controllers: [DocumentsController, DocumentEndpointsController, EndpointsController],
  providers: [
    DocumentService,
    EndpointService,
    DocumentParseService,
    SpecParserFactory,
    OpenApi3Parser,
    Swagger2Parser,
    PostmanV21Parser,
    DocumentOutboxRelay,
    ParseDocumentProcessor,
    { provide: API_DOCUMENT_REPOSITORY, useClass: MikroOrmApiDocumentRepository },
    { provide: ENDPOINT_REPOSITORY, useClass: MikroOrmEndpointRepository },
    { provide: SPEC_FORMAT_DETECTOR, useClass: DefaultSpecFormatDetector },
    { provide: OBJECT_STORAGE, useClass: S3CompatibleStorage },
    { provide: CONTENT_FETCHER, useClass: UndiciContentFetcher },
    { provide: QUEUE, useClass: BullMqDocumentQueue },
  ],
})
export class DocumentsModule {}
