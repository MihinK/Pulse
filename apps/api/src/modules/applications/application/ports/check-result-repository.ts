import type { CheckResult } from "../../domain/check-result.entity";

export interface CheckResultRepository {
  findByCheckRunId(checkRunId: string): Promise<CheckResult[]>;
  saveAll(results: CheckResult[]): Promise<void>;
}
