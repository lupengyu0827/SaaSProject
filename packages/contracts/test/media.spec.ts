/** 媒体契约稳定性测试。 */
import { describe, expect, it } from 'vitest';

import { MediaErrorCode } from '../src/index.js';

describe('media contract', () => {
  it('keeps stable machine-readable error codes', () => {
    expect(Object.values(MediaErrorCode)).toEqual([
      'MEDIA_UNSUPPORTED_MIME_TYPE',
      'MEDIA_FILE_TOO_LARGE',
      'MEDIA_SESSION_NOT_FOUND',
      'MEDIA_SESSION_EXPIRED',
      'MEDIA_UPLOAD_MISMATCH',
      'MEDIA_OBJECT_MISSING',
      'MEDIA_HASH_MISMATCH',
      'MEDIA_ASSET_NOT_FOUND',
    ]);
  });
});
