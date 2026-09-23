/** Store spec files and reports (technical plan 4.1) — `S3CompatibleStorage` (MinIO/S3/GCS). */
export interface ObjectStorage {
  put(key: string, content: Buffer, contentType?: string): Promise<void>;
  get(key: string): Promise<Buffer>;
}
