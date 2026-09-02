/** S3 媒体存储适配器测试：验证协议映射、哈希元数据、读取与缺失对象语义。 */
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { describe, expect, it, vi } from 'vitest';

import {
  S3MediaStorageAdapter,
  type S3CommandClient,
  type S3MediaStorageConfig,
} from '../src/media/infrastructure/s3-media-storage.adapter.js';

const CONFIG: S3MediaStorageConfig = {
  bucket: 'tenant-media',
  region: 'us-east-1',
  endpoint: 'http://localhost:9000',
  forcePathStyle: true,
  accessKeyId: 'test-access-key',
  secretAccessKey: 'test-secret-key',
};
const OBJECT_KEY = 'tenant-1/product/asset.jpg';

describe('S3MediaStorageAdapter', () => {
  it('writes content with deterministic SHA-256 metadata', async () => {
    const client = new TestS3Client();
    const adapter = new S3MediaStorageAdapter(CONFIG, client);
    const content = Buffer.from('luxury-media');

    const result = await adapter.put(OBJECT_KEY, content);

    expect(result).toEqual({
      sizeBytes: content.byteLength,
      sha256: 'ff9229230f183e7d7a8c9c5f3fa57526f8194b1eab23c10f3a13ec29321dcf1a',
    });
    const command = client.commands[0];
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect((command as PutObjectCommand).input).toMatchObject({
      Bucket: CONFIG.bucket,
      Key: OBJECT_KEY,
      ContentLength: content.byteLength,
      Metadata: { sha256: result.sha256 },
    });
  });

  it('maps head metadata and treats a 404 as a missing object', async () => {
    const client = new TestS3Client([
      { ContentLength: 12, Metadata: { sha256: 'stored-hash' } },
      notFoundError(),
    ]);
    const adapter = new S3MediaStorageAdapter(CONFIG, client);

    await expect(adapter.stat(OBJECT_KEY)).resolves.toEqual({
      sizeBytes: 12,
      sha256: 'stored-hash',
    });
    await expect(adapter.stat('missing.jpg')).resolves.toBeNull();
    expect(client.commands[0]).toBeInstanceOf(HeadObjectCommand);
  });

  it('reads and deletes objects through S3 commands', async () => {
    const client = new TestS3Client([
      {
        Body: { transformToByteArray: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])) },
      },
      {},
    ]);
    const adapter = new S3MediaStorageAdapter(CONFIG, client);

    await expect(adapter.read(OBJECT_KEY)).resolves.toEqual(Buffer.from([1, 2, 3]));
    await adapter.delete(OBJECT_KEY);

    expect(client.commands[0]).toBeInstanceOf(GetObjectCommand);
    expect(client.commands[1]).toBeInstanceOf(DeleteObjectCommand);
  });
});

class TestS3Client implements S3CommandClient {
  readonly commands: Array<
    PutObjectCommand | HeadObjectCommand | GetObjectCommand | DeleteObjectCommand
  > = [];

  constructor(private readonly responses: unknown[] = [{}]) {}

  send(command: PutObjectCommand): Promise<unknown>;
  send(command: HeadObjectCommand): Promise<{
    ContentLength?: number;
    Metadata?: Record<string, string>;
  }>;
  send(command: GetObjectCommand): Promise<{
    Body?: { transformToByteArray(): Promise<Uint8Array> };
  }>;
  send(command: DeleteObjectCommand): Promise<unknown>;
  send(
    command: PutObjectCommand | HeadObjectCommand | GetObjectCommand | DeleteObjectCommand,
  ): Promise<unknown> {
    this.commands.push(command);
    const response = this.responses.shift() ?? {};
    if (response instanceof Error) return Promise.reject(response);
    return Promise.resolve(response);
  }
}

function notFoundError(): Error {
  const error = new Error('not found');
  error.name = 'NotFound';
  Object.assign(error, { $metadata: { httpStatusCode: 404 } });
  return error;
}
