import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Client } from "minio";
import type { ObjectStorage } from "../application/ports/object-storage";

/**
 * Stores spec files (technical plan 4.1's `ObjectStorage`), targeting MinIO in `docker-compose`
 * and any other S3-compatible endpoint in production (Cloud edition config, per ADR-004). Creates
 * its bucket on module init rather than assuming an operator provisioned it out of band.
 */
@Injectable()
export class S3CompatibleStorage implements ObjectStorage, OnModuleInit {
  private readonly client: Client;
  private readonly bucket: string;

  public constructor(config: ConfigService) {
    this.client = new Client({
      endPoint: config.getOrThrow<string>("STORAGE_ENDPOINT"),
      port: Number(config.getOrThrow<string>("STORAGE_PORT")),
      useSSL: config.get<string>("STORAGE_USE_SSL") === "true",
      accessKey: config.getOrThrow<string>("STORAGE_ACCESS_KEY"),
      secretKey: config.getOrThrow<string>("STORAGE_SECRET_KEY"),
    });
    this.bucket = config.getOrThrow<string>("STORAGE_BUCKET");
  }

  public async onModuleInit(): Promise<void> {
    const exists = await this.client.bucketExists(this.bucket).catch(() => false);
    if (!exists) {
      await this.client.makeBucket(this.bucket);
    }
  }

  public async put(key: string, content: Buffer, contentType?: string): Promise<void> {
    await this.client.putObject(
      this.bucket,
      key,
      content,
      content.byteLength,
      contentType ? { "Content-Type": contentType } : undefined,
    );
  }

  public async get(key: string): Promise<Buffer> {
    const stream = await this.client.getObject(this.bucket, key);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk as Buffer);
    }
    return Buffer.concat(chunks);
  }
}
