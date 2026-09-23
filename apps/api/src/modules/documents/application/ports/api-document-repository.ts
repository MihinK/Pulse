import type { ApiDocument } from "../../domain/api-document.entity";

export interface ApiDocumentRepository {
  findById(id: string): Promise<ApiDocument | null>;
  findActiveByApplicationId(applicationId: string): Promise<ApiDocument | null>;
  /** Version history, newest first. */
  findByApplicationId(applicationId: string): Promise<ApiDocument[]>;
  save(document: ApiDocument): Promise<void>;
}
