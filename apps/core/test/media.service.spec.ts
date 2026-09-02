/** 媒体应用服务测试：覆盖租户隔离、上传校验、会话过期与确认幂等。 */
import { ConflictException, NotFoundException } from '@nestjs/common';
import type { MediaAssetResponse } from '@saas/contracts';
import { describe, expect, it, vi } from 'vitest';

import { MediaService } from '../src/media/application/media.service.js';
import type {
  MediaRepository,
  MediaUploadSessionRecord,
} from '../src/media/application/ports/media.repository.port.js';
import type { MediaStoragePort } from '../src/shared/ports/media-storage.port.js';

const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const ACTOR_ID = '22222222-2222-4222-8222-222222222222';
const SESSION_ID = '33333333-3333-4333-8333-333333333333';
const ASSET_ID = '44444444-4444-4444-8444-444444444444';

describe('MediaService security boundaries', () => {
  it('rejects a cross-tenant upload before writing storage', async () => {
    const repository = repositoryMock();
    const storage = storageMock();
    const service = new MediaService(repository, storage);

    await expect(
      service.upload(TENANT_ID, ACTOR_ID, SESSION_ID, 'image/jpeg', Buffer.from('image')),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(vi.mocked(repository.findOwnedSession)).toHaveBeenCalledWith(
      TENANT_ID,
      ACTOR_ID,
      SESSION_ID,
    );
    expect(vi.mocked(storage.put)).not.toHaveBeenCalled();
  });

  it('expires an elapsed session without writing storage', async () => {
    const repository = repositoryMock(
      uploadSession({ expiresAt: new Date('2026-08-31T23:59:59Z') }),
    );
    const storage = storageMock();
    vi.setSystemTime(new Date('2026-09-01T00:00:00Z'));

    await expect(
      new MediaService(repository, storage).upload(
        TENANT_ID,
        ACTOR_ID,
        SESSION_ID,
        'image/jpeg',
        Buffer.alloc(5),
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(vi.mocked(repository.markExpired)).toHaveBeenCalledWith(TENANT_ID, SESSION_ID);
    expect(vi.mocked(storage.put)).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('rejects MIME or size mismatches', async () => {
    const repository = repositoryMock(uploadSession());
    const storage = storageMock();

    await expect(
      new MediaService(repository, storage).upload(
        TENANT_ID,
        ACTOR_ID,
        SESSION_ID,
        'image/png',
        Buffer.alloc(5),
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(vi.mocked(storage.put)).not.toHaveBeenCalled();
  });

  it('returns the existing asset when confirmation repeats', async () => {
    const repository = repositoryMock(uploadSession({ status: 'confirmed' }));
    const existing = assetResponse();
    vi.mocked(repository.findAssetBySession).mockResolvedValue(existing);
    const storage = storageMock();

    await expect(
      new MediaService(repository, storage).confirm(TENANT_ID, ACTOR_ID, SESSION_ID, {}),
    ).resolves.toEqual(existing);

    expect(vi.mocked(storage.stat)).not.toHaveBeenCalled();
    expect(vi.mocked(repository.confirmUpload)).not.toHaveBeenCalled();
  });

  it('rejects confirmation when the physical object is missing', async () => {
    const repository = repositoryMock(uploadSession({ status: 'uploaded' }));
    const storage = storageMock();

    await expect(
      new MediaService(repository, storage).confirm(TENANT_ID, ACTOR_ID, SESSION_ID, {}),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(vi.mocked(repository.confirmUpload)).not.toHaveBeenCalled();
  });

  it('does not read an asset outside the current tenant', async () => {
    const repository = repositoryMock();
    const storage = storageMock();

    await expect(
      new MediaService(repository, storage).read(TENANT_ID, ASSET_ID),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(vi.mocked(repository.findReadableAsset)).toHaveBeenCalledWith(TENANT_ID, ASSET_ID);
    expect(vi.mocked(storage.read)).not.toHaveBeenCalled();
  });
});

function repositoryMock(
  session: MediaUploadSessionRecord | null = null,
): ReturnType<typeof mockRepository> {
  return mockRepository(session);
}

function mockRepository(session: MediaUploadSessionRecord | null): {
  [Key in keyof MediaRepository]: ReturnType<typeof vi.fn>;
} {
  return {
    createSession: vi.fn(),
    findOwnedSession: vi.fn().mockResolvedValue(session),
    markUploaded: vi.fn(),
    markExpired: vi.fn(),
    findAssetBySession: vi.fn().mockResolvedValue(null),
    confirmUpload: vi.fn(),
    findReadableAsset: vi.fn().mockResolvedValue(null),
    findPublicAsset: vi.fn().mockResolvedValue(null),
    listForAdmin: vi.fn(),
  };
}

function storageMock(): { [Key in keyof MediaStoragePort]: ReturnType<typeof vi.fn> } {
  return {
    put: vi.fn(),
    stat: vi.fn().mockResolvedValue(null),
    read: vi.fn(),
    delete: vi.fn(),
  };
}

function uploadSession(
  overrides: Partial<MediaUploadSessionRecord> = {},
): MediaUploadSessionRecord {
  return {
    id: SESSION_ID,
    tenantId: TENANT_ID,
    actorId: ACTOR_ID,
    purpose: 'product',
    objectKey: `${TENANT_ID}/product/${SESSION_ID}.jpg`,
    fileName: 'product.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 5,
    status: 'initiated',
    expiresAt: new Date('2026-09-02T00:00:00Z'),
    ...overrides,
  };
}

function assetResponse(): MediaAssetResponse {
  return {
    id: ASSET_ID,
    purpose: 'product' as const,
    status: 'temporary' as const,
    url: `/api/media/assets/${ASSET_ID}/content`,
    mimeType: 'image/jpeg' as const,
    sizeBytes: 5,
    sha256: 'a'.repeat(64),
    createdAt: '2026-09-01T00:00:00.000Z',
  };
}
