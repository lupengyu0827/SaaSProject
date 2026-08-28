export type InventoryOperation = 'in' | 'adjustment' | 'lock' | 'unlock' | 'out' | 'refund';

export interface InventoryCommandRequest {
  variantId: string;
  quantity: number;
  referenceType: string;
  referenceId: string;
  reason?: string;
}

export interface InventoryBalanceResponse {
  variantId: string;
  onHand: number;
  locked: number;
  available: number;
}

export interface InventoryTransactionResponse {
  id: string;
  type: InventoryOperation;
  qtyChange: number;
  referenceType: string;
  referenceId: string;
  createdAt: string;
  balance: InventoryBalanceResponse;
}
