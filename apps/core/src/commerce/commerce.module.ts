import { Module } from '@nestjs/common';

import { CatalogService } from './application/catalog.service.js';
import { ProductService } from './application/product.service.js';
import { CommerceController } from './interfaces/commerce.controller.js';
import { InventoryService } from './application/inventory.service.js';
import { OrderService } from './application/order.service.js';
import { PaymentService } from './application/payment.service.js';
import { OrderExpirationScheduler } from './infrastructure/order-expiration.scheduler.js';
import { MockPaymentProvider } from './infrastructure/mock-payment.provider.js';
import { PaymentProviderRegistry } from './infrastructure/payment-provider.registry.js';
import { WechatPayProvider } from './infrastructure/wechat-pay.provider.js';
import { WechatPayCallbackService } from './infrastructure/wechat-pay-callback.service.js';
import { PaymentCallbackController } from './interfaces/payment-callback.controller.js';
import { PaymentWebhookInboxService } from './application/payment-webhook-inbox.service.js';
import { PaymentWebhookScheduler } from './infrastructure/payment-webhook.scheduler.js';
import { ShipmentService } from './application/shipment.service.js';
import { RefundService } from './application/refund.service.js';
import { RefundWebhookInboxService } from './application/refund-webhook-inbox.service.js';
import { RefundWebhookScheduler } from './infrastructure/refund-webhook.scheduler.js';
import { WechatRefundCallbackService } from './infrastructure/wechat-refund-callback.service.js';
import { PaymentReconciliationService } from './application/payment-reconciliation.service.js';
import { PaymentReconciliationScheduler } from './infrastructure/payment-reconciliation.scheduler.js';
import { PaymentBillReconciliationService } from './application/payment-bill-reconciliation.service.js';
import { PaymentBillReconciliationScheduler } from './infrastructure/payment-bill-reconciliation.scheduler.js';
import { WebhookOperationsService } from './application/webhook-operations.service.js';
import { ProductIntakeService } from './application/product-intake.service.js';

@Module({
  controllers: [CommerceController, PaymentCallbackController],
  providers: [
    CatalogService,
    ProductService,
    InventoryService,
    OrderService,
    PaymentService,
    OrderExpirationScheduler,
    MockPaymentProvider,
    WechatPayProvider,
    PaymentProviderRegistry,
    WechatPayCallbackService,
    PaymentWebhookInboxService,
    PaymentWebhookScheduler,
    ShipmentService,
    RefundService,
    RefundWebhookInboxService,
    RefundWebhookScheduler,
    WechatRefundCallbackService,
    PaymentReconciliationService,
    PaymentReconciliationScheduler,
    PaymentBillReconciliationService,
    PaymentBillReconciliationScheduler,
    WebhookOperationsService,
    ProductIntakeService,
  ],
})
export class CommerceModule {}
