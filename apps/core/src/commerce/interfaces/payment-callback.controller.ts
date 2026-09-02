import { BadRequestException, Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';

import { WechatPayCallbackService } from '../infrastructure/wechat-pay-callback.service.js';
import { WechatRefundCallbackService } from '../infrastructure/wechat-refund-callback.service.js';

@Controller('payment-callbacks')
export class PaymentCallbackController {
  constructor(
    private readonly wechat: WechatPayCallbackService,
    private readonly wechatRefund: WechatRefundCallbackService,
  ) {}

  @Post('wechat')
  @HttpCode(204)
  async wechatCallback(
    @Req() request: { rawBody?: Buffer },
    @Headers('wechatpay-timestamp') timestamp: string,
    @Headers('wechatpay-nonce') nonce: string,
    @Headers('wechatpay-signature') signature: string,
    @Headers('wechatpay-serial') serial: string,
  ): Promise<void> {
    if (!request.rawBody || !timestamp || !nonce || !signature || !serial)
      throw new BadRequestException('Incomplete WeChat Pay callback');
    await this.wechat.handle(
      { timestamp, nonce, signature, serial },
      request.rawBody.toString('utf8'),
    );
  }

  /** 微信支付退款结果通知。 */
  @Post('wechat/refunds')
  @HttpCode(204)
  async wechatRefundCallback(
    @Req() request: { rawBody?: Buffer },
    @Headers('wechatpay-timestamp') timestamp: string,
    @Headers('wechatpay-nonce') nonce: string,
    @Headers('wechatpay-signature') signature: string,
    @Headers('wechatpay-serial') serial: string,
  ): Promise<void> {
    if (!request.rawBody || !timestamp || !nonce || !signature || !serial)
      throw new BadRequestException('Incomplete WeChat Pay refund callback');
    await this.wechatRefund.handle(
      { timestamp, nonce, signature, serial },
      request.rawBody.toString('utf8'),
    );
  }
}
