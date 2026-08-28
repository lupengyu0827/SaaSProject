/** 发货领域规则：校验物流标识和发货明细，不依赖数据库实现。 */
import { ConflictException } from '@nestjs/common';
import type { CreateShipmentRequest } from '@saas/contracts';

const MAX_CARRIER_CODE_LENGTH = 40;
const MAX_CARRIER_NAME_LENGTH = 80;
const MAX_TRACKING_NO_LENGTH = 100;

/** 校验创建物流单命令。 */
export function assertCreateShipment(input: CreateShipmentRequest): void {
  assertText(input.carrierCode, MAX_CARRIER_CODE_LENGTH, 'carrier code');
  assertText(input.carrierName, MAX_CARRIER_NAME_LENGTH, 'carrier name');
  assertText(input.trackingNo, MAX_TRACKING_NO_LENGTH, 'tracking number');
  if (!input.items) return;
  if (input.items.length === 0) throw new ConflictException('Shipment items cannot be empty');
  const orderItemIds = new Set<string>();
  for (const item of input.items) {
    if (!item.orderItemId || !Number.isSafeInteger(item.quantity) || item.quantity <= 0)
      throw new ConflictException('Each shipment item requires an order item and quantity');
    if (orderItemIds.has(item.orderItemId))
      throw new ConflictException('Duplicate order item in shipment');
    orderItemIds.add(item.orderItemId);
  }
}

/** 校验本次发货数量不超过订单剩余可发数量。 */
export function assertShippableQuantity(requested: number, remaining: number): void {
  if (remaining <= 0) throw new ConflictException('Order item has already been fully shipped');
  if (requested > remaining)
    throw new ConflictException('Shipment quantity exceeds the remaining order quantity');
}

function assertText(value: string, maxLength: number, label: string): void {
  if (!value?.trim() || value.trim().length > maxLength)
    throw new ConflictException(`A valid ${label} is required`);
}
