import { Readable } from "node:stream";
import { ConfigService } from "@nestjs/config";
import { S3CompatibleStorage } from "./s3-compatible-storage";

const bucketExistsMock = jest.fn();
const makeBucketMock = jest.fn();
const putObjectMock = jest.fn();
const getObjectMock = jest.fn();

jest.mock("minio", () => ({
  Client: jest.fn().mockImplementation(() => ({
    bucketExists: bucketExistsMock,
    makeBucket: makeBucketMock,
    putObject: putObjectMock,
    getObject: getObjectMock,
  })),
}));

describe("S3CompatibleStorage", () => {
  beforeEach(() => {
    bucketExistsMock.mockReset();
    makeBucketMock.mockReset().mockResolvedValue(undefined);
    putObjectMock.mockReset().mockResolvedValue(undefined);
    getObjectMock.mockReset();
  });

  function build() {
    const config = new ConfigService({
      STORAGE_ENDPOINT: "localhost",
      STORAGE_PORT: "9000",
      STORAGE_USE_SSL: "false",
      STORAGE_ACCESS_KEY: "pulse",
      STORAGE_SECRET_KEY: "pulse_dev_password",
      STORAGE_BUCKET: "pulse-documents",
    });
    return { storage: new S3CompatibleStorage(config) };
  }

  it("creates the bucket on init when it doesn't already exist", async () => {
    const { storage } = build();
    bucketExistsMock.mockResolvedValue(false);

    await storage.onModuleInit();

    expect(makeBucketMock).toHaveBeenCalledWith("pulse-documents");
  });

  it("leaves an existing bucket alone", async () => {
    const { storage } = build();
    bucketExistsMock.mockResolvedValue(true);

    await storage.onModuleInit();

    expect(makeBucketMock).not.toHaveBeenCalled();
  });

  it("creates the bucket when checking existence itself fails", async () => {
    const { storage } = build();
    bucketExistsMock.mockRejectedValue(new Error("not found"));

    await storage.onModuleInit();

    expect(makeBucketMock).toHaveBeenCalledWith("pulse-documents");
  });

  it("puts content with a content type", async () => {
    const { storage } = build();
    const content = Buffer.from("hello");

    await storage.put("key-1", content, "application/json");

    expect(putObjectMock).toHaveBeenCalledWith("pulse-documents", "key-1", content, content.byteLength, {
      "Content-Type": "application/json",
    });
  });

  it("puts content without a content type", async () => {
    const { storage } = build();
    const content = Buffer.from("hello");

    await storage.put("key-1", content);

    expect(putObjectMock).toHaveBeenCalledWith("pulse-documents", "key-1", content, content.byteLength, undefined);
  });

  it("reads content back as a Buffer", async () => {
    const { storage } = build();
    getObjectMock.mockResolvedValue(Readable.from([Buffer.from("hel"), Buffer.from("lo")]));

    const result = await storage.get("key-1");

    expect(result.toString("utf8")).toBe("hello");
    expect(getObjectMock).toHaveBeenCalledWith("pulse-documents", "key-1");
  });
});
