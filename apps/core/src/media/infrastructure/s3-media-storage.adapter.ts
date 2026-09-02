/** S3 兼容媒体存储适配器：供 MinIO、AWS S3 及其他 S3 协议对象存储使用。 */
import { createHash } from 'node:crypto';

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';

import type { MediaStoragePort, StoredMediaObject } from '../../shared/ports/media-storage.port.js';

const SHA256_METADATA_KEY = 'sha256';

export interface S3MediaStorageConfig {
  bucket: string;
  region: string;
  endpoint?: string;
  forcePathStyle: boolean;
  accessKeyId?: string;
  secretAccessKey?: string;
}

export interface S3CommandClient {
  send(command: PutObjectCommand): Promise<unknown>;
  send(command: HeadObjectCommand): Promise<{
    ContentLength?: number;
    Metadata?: Record<string, string>;
  }>;
  send(command: GetObjectCommand): Promise<{
    Body?: { transformToByteArray(): Promise<Uint8Array> };
  }>;
  send(command: DeleteObjectCommand): Promise<unknown>;
}

export class S3MediaStorageAdapter implements MediaStoragePort {
  private readonly bucket: string;

  constructor(
    config: S3MediaStorageConfig = s3MediaStorageConfigFromEnvironment(),
    private readonly client: S3CommandClient = new S3Client(toClientConfig(config)),
  ) {
    this.bucket = config.bucket;
  }

  /** 写入对象，同时保存服务端确认所需的 SHA-256 元数据。 */
  async put(objectKey: string, content: Buffer): Promise<StoredMediaObject> {
    const sha256 = digest(content);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        Body: content,
        ContentLength: content.byteLength,
        Metadata: { [SHA256_METADATA_KEY]: sha256 },
      }),
    );
    return { sizeBytes: content.byteLength, sha256 };
  }

  /** 读取对象元数据；对象不存在时返回 null。 */
  async stat(objectKey: string): Promise<StoredMediaObject | null> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: objectKey }),
      );
      const sha256 = result.Metadata?.[SHA256_METADATA_KEY];
      if (result.ContentLength === undefined || !sha256) {
        throw new Error(`Media object metadata is incomplete: ${objectKey}`);
      }
      return { sizeBytes: result.ContentLength, sha256 };
    } catch (error: unknown) {
      if (isMissingObject(error)) return null;
      throw error;
    }
  }

  /** 下载完整对象内容。 */
  async read(objectKey: string): Promise<Buffer> {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: objectKey }),
    );
    if (!result.Body) throw new Error(`Media object body is missing: ${objectKey}`);
    return Buffer.from(await result.Body.transformToByteArray());
  }

  /** 幂等删除对象。 */
  async delete(objectKey: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: objectKey }));
  }
}

/** 从环境变量读取并校验 S3/MinIO 连接配置。 */
export function s3MediaStorageConfigFromEnvironment(): S3MediaStorageConfig {
  const bucket = requiredEnvironment('MEDIA_S3_BUCKET', process.env.MINIO_BUCKET);
  const accessKeyId = process.env.MEDIA_S3_ACCESS_KEY_ID ?? process.env.MINIO_ROOT_USER;
  const secretAccessKey = process.env.MEDIA_S3_SECRET_ACCESS_KEY ?? process.env.MINIO_ROOT_PASSWORD;
  if ((accessKeyId && !secretAccessKey) || (!accessKeyId && secretAccessKey)) {
    throw new Error(
      'MEDIA_S3_ACCESS_KEY_ID and MEDIA_S3_SECRET_ACCESS_KEY must be configured together',
    );
  }
  return {
    bucket,
    region: process.env.MEDIA_S3_REGION ?? 'us-east-1',
    endpoint: process.env.MEDIA_S3_ENDPOINT ?? process.env.MINIO_ENDPOINT,
    forcePathStyle: process.env.MEDIA_S3_FORCE_PATH_STYLE !== 'false',
    accessKeyId,
    secretAccessKey,
  };
}

function toClientConfig(config: S3MediaStorageConfig): S3ClientConfig {
  return {
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle,
    credentials:
      config.accessKeyId && config.secretAccessKey
        ? { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey }
        : undefined,
  };
}

function requiredEnvironment(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value?.trim()) throw new Error(`${name} is required when MEDIA_STORAGE_DRIVER=s3`);
  return value;
}

function digest(content: Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

function isMissingObject(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const metadata = '$metadata' in error ? error.$metadata : undefined;
  const statusCode =
    typeof metadata === 'object' && metadata && 'httpStatusCode' in metadata
      ? metadata.httpStatusCode
      : undefined;
  return error.name === 'NotFound' || error.name === 'NoSuchKey' || statusCode === 404;
}
