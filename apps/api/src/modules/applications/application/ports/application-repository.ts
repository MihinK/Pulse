import type { Application } from "../../domain/application.entity";
import type { ApplicationStatus } from "../../domain/application-status.enum";
import type { Environment } from "../../domain/environment.enum";

export interface ApplicationFilter {
  status?: ApplicationStatus | undefined;
  environment?: Environment | undefined;
  /** Case-insensitive substring match against `name`. */
  search?: string | undefined;
}

export interface ApplicationRepository {
  findById(id: string): Promise<Application | null>;
  findAll(filter?: ApplicationFilter): Promise<Application[]>;
  save(application: Application): Promise<void>;
}
