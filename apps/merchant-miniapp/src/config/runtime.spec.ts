/** 商家与消费者小程序会话缓存隔离测试。 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearMerchantSession,
  getMerchantAccessToken,
  getMerchantRefreshToken,
  getMerchantTenantId,
  saveMerchantSession,
  saveMerchantTenantId,
} from './runtime';

describe('merchant runtime storage', () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    storage.set('saas.accessToken', 'customer-access');
    vi.stubGlobal('uni', {
      getStorageSync: (key: string) => storage.get(key) ?? '',
      setStorageSync: (key: string, value: string) => storage.set(key, value),
      removeStorageSync: (key: string) => storage.delete(key),
    });
  });

  it('persists and clears merchant keys without touching the customer session', () => {
    saveMerchantTenantId('tenant-a');
    saveMerchantSession('merchant-access', 'merchant-refresh');

    expect(getMerchantTenantId()).toBe('tenant-a');
    expect(getMerchantAccessToken()).toBe('merchant-access');
    expect(getMerchantRefreshToken()).toBe('merchant-refresh');

    clearMerchantSession();

    expect(getMerchantTenantId()).toBeNull();
    expect(getMerchantAccessToken()).toBeNull();
    expect(storage.get('saas.accessToken')).toBe('customer-access');
  });
});
