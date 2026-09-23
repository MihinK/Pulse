import type { EntityManager } from "@mikro-orm/postgresql";
import type { Job } from "bullmq";
import { ParseDocumentProcessor } from "./parse-document.processor";
import type { DocumentParseService } from "../application/document-parse.service";

function buildEm(): EntityManager {
  const forkedEm = {
    getConnection: jest.fn().mockReturnValue({ execute: jest.fn().mockResolvedValue(undefined) }),
    getTransactionContext: jest.fn().mockReturnValue("tx-context"),
  };
  return {
    transactional: jest.fn(async (callback: (em: unknown) => Promise<unknown>) => callback(forkedEm)),
  } as unknown as EntityManager;
}

describe("ParseDocumentProcessor", () => {
  it("executes the document parse inside a bypass_rls transaction", async () => {
    const documentParseService = { execute: jest.fn().mockResolvedValue(undefined) } as unknown as DocumentParseService;
    const em = buildEm();
    const processor = new ParseDocumentProcessor(em, documentParseService);
    const job = { data: { apiDocumentId: "doc-1" } } as Job<{ apiDocumentId: string }>;

    await processor.process(job);

    expect(em.transactional).toHaveBeenCalledTimes(1);
    expect(documentParseService.execute).toHaveBeenCalledWith("doc-1");
  });
});
