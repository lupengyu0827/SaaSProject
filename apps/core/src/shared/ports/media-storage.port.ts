/** 媒体对象存储防腐层；本地开发和 S3 兼容存储必须实现同一接口。 */
export const MEDIA_STORAGE_PORT = Symbol('MEDIA_STORAGE_PORT');

export interface StoredMediaObject {
  sizeBytes: number;
  sha256: string;
}

export interface MediaStoragePort {
  put(objectKey: string, content: Buffer): Promise<StoredMediaObject>;
  stat(objectKey: string): Promise<StoredMediaObject | null>;
  read(objectKey: string): Promise<Buffer>;
  delete(objectKey: string): Promise<void>;
}
