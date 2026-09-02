import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  InventoryBalanceResponse,
  InventoryCommandRequest,
  InventoryOperation,
  InventoryTransactionResponse,
} from '@saas/contracts';

import { Prisma, type InventoryTransaction } from '../../generated/prisma/index.js';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service.js';
import { assertInventoryCommand, calculateInventoryBalance } from '../domain/inventory.rules.js';

@Injectable()
export class InventoryService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  getBalance(tenantId: string, variantId: string): Promise<InventoryBalanceResponse> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
      await this.assertVariant(tx, tenantId, variantId);
      return this.balance(tx, tenantId, variantId);
    });
  }

  execute(
    tenantId: string,
    actorId: string,
    operation: InventoryOperation,
    input: InventoryCommandRequest,
  ): Promise<InventoryTransactionResponse> {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${tenantId}:${input.variantId}`}, 0))`;
        await this.assertVariant(tx, tenantId, input.variantId);

        const existing = await tx.inventoryTransaction.findUnique({
          where: {
            tenantId_variantId_type_referenceType_referenceId: {
              tenantId,
              variantId: input.variantId,
              type: operation,
              referenceType: input.referenceType,
              referenceId: input.referenceId,
            },
          },
        });
        if (existing)
          return this.response(existing, await this.balance(tx, tenantId, input.variantId));

        const current = await this.balance(tx, tenantId, input.variantId);
        assertInventoryCommand(operation, input.quantity, current);
        const qtyChange = this.qtyChange(operation, input.quantity);
        const transaction = await tx.inventoryTransaction.create({
          data: {
            tenantId,
            variantId: input.variantId,
            type: operation,
            qtyChange,
            referenceType: input.referenceType,
            referenceId: input.referenceId,
            reason: input.reason,
            operatorId: actorId,
          },
        });
        if (operation === 'out') {
          await tx.inventoryTransaction.create({
            data: {
              tenantId,
              variantId: input.variantId,
              type: 'unlock',
              qtyChange: input.quantity,
              referenceType: input.referenceType,
              referenceId: input.referenceId,
              reason: 'Released after inventory deduction',
              operatorId: actorId,
            },
          });
        }
        return this.response(transaction, await this.balance(tx, tenantId, input.variantId));
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 },
    );
  }

  private async assertVariant(
    tx: Prisma.TransactionClient,
    tenantId: string,
    variantId: string,
  ): Promise<void> {
    if (!(await tx.productVariant.findFirst({ where: { id: variantId, tenantId } }))) {
      throw new NotFoundException('SKU not found');
    }
  }

  private async balance(
    tx: Prisma.TransactionClient,
    tenantId: string,
    variantId: string,
  ): Promise<InventoryBalanceResponse> {
    const entries = await tx.inventoryTransaction.findMany({
      where: { tenantId, variantId },
      select: { type: true, qtyChange: true },
    });
    return calculateInventoryBalance(variantId, entries);
  }

  private qtyChange(operation: InventoryOperation, quantity: number): number {
    if (operation === 'out' || operation === 'lock') return -quantity;
    return quantity;
  }

  private response(
    transaction: InventoryTransaction,
    balance: InventoryBalanceResponse,
  ): InventoryTransactionResponse {
    return {
      id: transaction.id.toString(),
      type: transaction.type as InventoryOperation,
      qtyChange: transaction.qtyChange,
      referenceType: transaction.referenceType,
      referenceId: transaction.referenceId,
      createdAt: transaction.createdAt.toISOString(),
      balance,
    };
  }
}
