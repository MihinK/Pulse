import type { Endpoint } from "../../domain/endpoint.entity";

export interface EndpointRepository {
  findById(id: string): Promise<Endpoint | null>;
  findByApiDocumentId(apiDocumentId: string): Promise<Endpoint[]>;
  saveAll(endpoints: Endpoint[]): Promise<void>;
  save(endpoint: Endpoint): Promise<void>;
}
