/** 媒体模块：独立于商品领域，可复用于回收、售后和店铺配置。 */
import { Module } from '@nestjs/common';

import { MEDIA_STORAGE_PORT, type MediaStoragePort } from '../shared/ports/media-storage.port.js';
import { MediaService } from './application/media.service.js';
import { MediaCleanupService } from './application/media-cleanup.service.js';
import { MEDIA_CLEANUP_REPOSITORY } from './application/ports/media-cleanup.repository.port.js';
import { MEDIA_REPOSITORY } from './application/ports/media.repository.port.js';
import { MediaCleanupScheduler } from './infrastructure/media-cleanup.scheduler.js';
import { LocalMediaStorageAdapter } from './infrastructure/local-media-storage.adapter.js';
import { PrismaMediaCleanupRepository } from './infrastructure/prisma-media-cleanup.repository.js';
import { PrismaMediaRepository } from './infrastructure/prisma-media.repository.js';
import { S3MediaStorageAdapter } from './infrastructure/s3-media-storage.adapter.js';
import { MediaController } from './interfaces/media.controller.js';

@Module({
  controllers: [MediaController],
  providers: [
    MediaService,
    MediaCleanupService,
    MediaCleanupScheduler,
    PrismaMediaCleanupRepository,
    PrismaMediaRepository,
    {
      provide: MEDIA_STORAGE_PORT,
      useFactory: mediaStorageFromEnvironment,
    },
    { provide: MEDIA_CLEANUP_REPOSITORY, useExisting: PrismaMediaCleanupRepository },
    { provide: MEDIA_REPOSITORY, useExisting: PrismaMediaRepository },
  ],
})
export class MediaModule {}

/** 按部署环境选择存储实现；生产环境禁止回退到本地磁盘。 */
function mediaStorageFromEnvironment(): MediaStoragePort {
  const driver = process.env.MEDIA_STORAGE_DRIVER ?? 'local';
  if (driver === 's3') return new S3MediaStorageAdapter();
  if (driver === 'local' && process.env.NODE_ENV !== 'production') {
    return new LocalMediaStorageAdapter();
  }
  throw new Error(
    `Unsupported MEDIA_STORAGE_DRIVER for ${process.env.NODE_ENV ?? 'development'}: ${driver}`,
  );
}
