/** 商家库存命令 API：调用 Gateway 转发至 Core 的库存账目操作。 */
import type {
  InventoryBalanceResponse,
  InventoryCommandRequest,
  InventoryOperation,
  InventoryTransactionResponse,
} from '@saas/contracts';

import {
  getMerchantAccessToken,
  getMerchantApiBaseUrl,
  getMerchantTenantId,
} from '../../config/runtime';
import { unwrapApiData } from '../envelope';
import { MerchantApiError } from '../errors';

/** 查询变体的库存余额（在手 / 锁定 / 可用）。 */
export function getInventoryBalance(variantId: string): Promise<InventoryBalanceResponse> {
  return requestInventory<InventoryBalanceResponse>('GET', `/commerce/inventory/${variantId}`);
}

/**
 * 提交库存账目命令（lock / unlock / in / out / adjustment / refund）。
 * 参考号 referenceType+referenceId 组成幂等键，相同组合重试只返回原事务。
 */
export function executeInventoryCommand(
  operation: InventoryOperation,
  input: InventoryCommandRequest,
): Promise<InventoryTransactionResponse> {
  return requestInventory<InventoryTransactionResponse>(
    'POST',
    `/commerce/inventory/${operation}`,
    input,
  );
}

/** 锁单：quantity 件商品从可用库存转入锁定库存。 */
export function lockInventory(
  variantId: string,
  quantity: number,
  options: { referenceType?: string; referenceId?: string; reason?: string } = {},
): Promise<InventoryTransactionResponse> {
  return executeInventoryCommand('lock', {
    variantId,
    quantity,
    referenceType: options.referenceType ?? 'manual_lock',
    referenceId: options.referenceId ?? variantId,
    reason: options.reason ?? '商家端手动锁单',
  });
}

/** 解锁：quantity 件商品从锁定库存返还可用库存。 */
export function unlockInventory(
  variantId: string,
  quantity: number,
  options: { referenceType?: string; referenceId?: string; reason?: string } = {},
): Promise<InventoryTransactionResponse> {
  return executeInventoryCommand('unlock', {
    variantId,
    quantity,
    referenceType: options.referenceType ?? 'manual_unlock',
    referenceId: options.referenceId ?? variantId,
    reason: options.reason ?? '商家端手动解锁',
  });
}

function requestInventory<T>(
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
): Promise<T> {
  const accessToken = getMerchantAccessToken();
  const tenantId = getMerchantTenantId();
  if (!accessToken || !tenantId) throw new MerchantApiError('请先登录店铺');
  return new Promise<T>((resolve, reject) => {
    void uni.request({
      url: `${getMerchantApiBaseUrl()}${path}`,
      method,
      header: {
        Authorization: `Bearer ${accessToken}`,
        'X-Tenant-Id': tenantId,
        'content-type': 'application/json',
      },
      data: body as UniApp.RequestOptions['data'],
      timeout: 15_000,
      success: (response) => {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(unwrapApiData(response.data) as T);
          return;
        }
        const payload = response.data as { message?: unknown } | null;
        const message =
          payload && typeof payload.message === 'string' ? payload.message : '库存操作失败';
        reject(new MerchantApiError(message, response.statusCode));
      },
      fail: (failure) => reject(new MerchantApiError(failure.errMsg ?? '网络连接失败')),
    });
  });
}