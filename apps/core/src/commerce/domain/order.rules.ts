import { ConflictException } from '@nestjs/common';
import type { CreateOrderRequest, OrderStatus } from '@saas/contracts';

export function assertCreateOrder(input: CreateOrderRequest): void {
  if (!input.idempotencyKey?.trim() || input.idempotencyKey.length > 100)
    throw new ConflictException('A valid idempotency key is required');
  if (!input.items.length) throw new ConflictException('Order must contain at least one item');
  const variants = new Set<string>();
  for (const item of input.items) {
    if (!item.variantId || !Number.isSafeInteger(item.quantity) || item.quantity <= 0)
      throw new ConflictException('Each item requires a SKU and a positive integer quantity');
    if (variants.has(item.variantId)) throw new ConflictException('Duplicate SKU in order');
    variants.add(item.variantId);
  }
}

export function assertOrderTransition(current: OrderStatus, next: OrderStatus): void {
  const allowed: Record<OrderStatus, OrderStatus[]> = {
    pending: ['paid', 'canceled', 'expired'],
    paid: ['fulfilled', 'partially_refunded', 'refunded'],
    fulfilled: ['partially_refunded', 'refunded'],
    partially_refunded: ['partially_refunded', 'refunded'],
    refunded: [],
    canceled: [],
    expired: [],
  };
  if (!allowed[current].includes(next))
    throw new ConflictException(`Order cannot transition from ${current} to ${next}`);
}
