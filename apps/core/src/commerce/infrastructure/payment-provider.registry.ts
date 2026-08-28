/** 支付渠道注册表：通过显式依赖注入聚合支付适配器并按渠道提供实现。 */
import { ConflictException, Inject, Injectable } from '@nestjs/common';
import type { PaymentChannel } from '@saas/contracts';

import { MockPaymentProvider } from './mock-payment.provider.js';
import type { PaymentProvider } from './payment-provider.js';
import { WechatPayProvider } from './wechat-pay.provider.js';

@Injectable()
export class PaymentProviderRegistry {
  private readonly providers: Map<PaymentChannel, PaymentProvider>;

  constructor(
    @Inject(MockPaymentProvider) mock: MockPaymentProvider,
    @Inject(WechatPayProvider) wechat: WechatPayProvider,
  ) {
    this.providers = new Map<PaymentChannel, PaymentProvider>([
      [mock.channel, mock],
      [wechat.channel, wechat],
    ]);
  }

  /** 根据支付渠道取得已配置的支付适配器。 */
  get(channel: PaymentChannel): PaymentProvider {
    const provider = this.providers.get(channel);
    if (!provider) throw new ConflictException(`Payment channel ${channel} is not configured`);
    return provider;
  }
}
