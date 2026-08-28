import { ConflictException } from '@nestjs/common';
import type { InventoryBalanceResponse, InventoryOperation } from '@saas/contracts';

export interface LedgerEntry {
  type: string;
  qtyChange: number;
}

export function calculateInventoryBalance(
  variantId: string,
  entries: LedgerEntry[],
): InventoryBalanceResponse {
  let onHand = 0;
  let lockDelta = 0;
  for (const entry of entries) {
    if (['in', 'out', 'adjustment', 'refund'].includes(entry.type)) onHand += entry.qtyChange;
    if (['lock', 'unlock'].includes(entry.type)) lockDelta += entry.qtyChange;
  }
  const locked = lockDelta === 0 ? 0 : -lockDelta;
  return { variantId, onHand, locked, available: onHand - locked };
}

export function assertInventoryCommand(
  operation: InventoryOperation,
  quantity: number,
  balance: InventoryBalanceResponse,
): void {
  if (!['in', 'adjustment', 'lock', 'unlock', 'out', 'refund'].includes(operation)) {
    throw new ConflictException('Unsupported inventory operation');
  }
  if (!Number.isSafeInteger(quantity) || quantity === 0) {
    throw new ConflictException('Quantity must be a non-zero safe integer');
  }
  if (operation !== 'adjustment' && quantity < 0) {
    throw new ConflictException('Quantity must be positive');
  }
  if (operation === 'lock' && balance.available < quantity) {
    throw new ConflictException('Insufficient available inventory');
  }
  if ((operation === 'unlock' || operation === 'out') && balance.locked < quantity) {
    throw new ConflictException('Insufficient locked inventory');
  }
  if (operation === 'adjustment' && balance.onHand + quantity < balance.locked) {
    throw new ConflictException('Adjustment cannot reduce stock below locked inventory');
  }
}
