import type { CheckRun } from "../../domain/check-run.entity";

export interface CheckRunRepository {
  findById(id: string): Promise<CheckRun | null>;
  findByApplicationId(applicationId: string, limit?: number): Promise<CheckRun[]>;
  save(checkRun: CheckRun): Promise<void>;
}
