/** 本地媒体存储适配器；生产环境可替换为实现同一 Port 的 S3 Adapter。 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { Injectable } from '@nestjs/common';

import type { MediaStoragePort, StoredMediaObject } from '../../shared/ports/media-storage.port.js';

@Injectable()
export class LocalMediaStorageAdapter implements MediaStoragePort {
  private readonly root = resolve(process.env.MEDIA_LOCAL_ROOT ?? '/private/tmp/saas-platform-media');

  async put(objectKey: string, content: Buffer): Promise<StoredMediaObject> {
    const target = this.path(objectKey);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content, { flag: 'wx' });
    return { sizeBytes: content.byteLength, sha256: digest(content) };
  }

  async stat(objectKey: string): Promise<StoredMediaObject | null> {
    try {
      const content = await readFile(this.path(objectKey));
      return { sizeBytes: content.byteLength, sha256: digest(content) };
    } catch (error: unknown) {
      if (isMissing(error)) return null;
      throw error;
    }
  }

  read(objectKey: string): Promise<Buffer> {
    return readFile(this.path(objectKey));
  }

  async delete(objectKey: string): Promise<void> {
    await rm(this.path(objectKey), { force: true });
  }

  private path(objectKey: string): string {
    const target = resolve(this.root, objectKey);
    if (!target.startsWith(`${this.root}/`)) throw new Error('Invalid media object key');
    return target;
  }
}

function digest(content: Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
