import { BadRequestException, Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';

import { WechatPayCallbackService } from '../infrastructure/wechat-pay-callback.service.js';

@Controller('payment-callbacks')
export class PaymentCallbackController {
  constructor(private readonly wechat: WechatPayCallbackService) {}

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
}
