/** 商品草稿乐观锁回归：Core 必须返回稳定错误码和服务端当前版本。 */
import { ConflictException } from '@nestjs/common';
import { ProductDraftErrorCode } from '@saas/contracts';
import { describe, expect, it, vi } from 'vitest';

import { ProductService } from '../src/commerce/application/product.service.js';
import type { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service.js';

describe('Product draft optimistic lock', () => {
  it('returns code 40901 and the latest server version after a stale autosave', async () => {
    const findFirst = vi
      .fn()
      .mockResolvedValueOnce({ version: 3, attributes: {} })
      .mockResolvedValueOnce({ version: 3 });
    const transactionClient = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      product: { findFirst, updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      category: { findFirst: vi.fn() },
      brand: { findFirst: vi.fn() },
    };
    const prisma = {
      $transaction: (operation: (tx: typeof transactionClient) => Promise<unknown>) =>
        operation(transactionClient),
    } as unknown as PrismaService;
    const products = new ProductService(prisma);

    const result = products.saveDraft('tenant-1', 'actor-1', 'draft-1', {
      version: 1,
      name: '并发修改',
    });

    try {
      await result;
      throw new Error('expected optimistic lock conflict');
    } catch (error) {
      if (!(error instanceof ConflictException)) throw error;
      expect(error).toBeInstanceOf(ConflictException);
      expect(error).toMatchObject({
        response: {
          code: ProductDraftErrorCode.VERSION_CONFLICT,
          data: { currentVersion: 3 },
        },
      });
    }
  });
});
