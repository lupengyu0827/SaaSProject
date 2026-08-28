import { readFile } from 'node:fs/promises';

import { ConflictException, Injectable } from '@nestjs/common';

import type {
  CreateProviderPaymentInput,
  CreateProviderRefundInput,
  CreateProviderRefundResult,
  PaymentProvider,
} from './payment-provider.js';
import { signWechatMessage, wechatNonce, wechatRequestMessage } from './wechat-pay.crypto.js';

@Injectable()
export class WechatPayProvider implements PaymentProvider {
  readonly channel = 'wechat_pay' as const;

  async createPayment(input: CreateProviderPaymentInput): Promise<Record<string, string>> {
    const appId = this.required('WECHAT_PAY_APP_ID');
    const merchantId = this.required('WECHAT_PAY_MERCHANT_ID');
    const serialNo = this.required('WECHAT_PAY_MERCHANT_SERIAL_NO');
    const notifyUrl = this.required('WECHAT_PAY_NOTIFY_URL');
    const privateKey = await readFile(this.required('WECHAT_PAY_PRIVATE_KEY_PATH'), 'utf8');
    if (!input.openId) throw new ConflictException('openId is required for WeChat JSAPI payment');

    const path = '/v3/pay/transactions/jsapi';
    const body = JSON.stringify({
      appid: appId,
      mchid: merchantId,
      description: input.description.slice(0, 127),
      out_trade_no: input.paymentNo.slice(0, 32),
      time_expire: input.expiresAt.toISOString(),
      notify_url: notifyUrl,
      attach: JSON.stringify({ tenantId: input.tenantId, paymentId: input.paymentId }),
      amount: { total: this.toCents(input.amount), currency: 'CNY' },
      payer: { openid: input.openId },
    });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = wechatNonce();
    const signature = signWechatMessage(
      wechatRequestMessage('POST', path, timestamp, nonce, body),
      privateKey,
    );
    const authorization =
      `WECHATPAY2-SHA256-RSA2048 mchid="${merchantId}",nonce_str="${nonce}",` +
      `timestamp="${timestamp}",serial_no="${serialNo}",signature="${signature}"`;
    const response = await fetch(`https://api.mch.weixin.qq.com${path}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: authorization,
      },
      body,
    });
    const payload = (await response.json()) as { prepay_id?: string; message?: string };
    if (!response.ok || !payload.prepay_id)
      throw new ConflictException(payload.message ?? 'WeChat Pay order creation failed');

    const frontendTimestamp = Math.floor(Date.now() / 1000).toString();
    const frontendNonce = wechatNonce();
    const packageValue = `prepay_id=${payload.prepay_id}`;
    const paySign = signWechatMessage(
      `${appId}\n${frontendTimestamp}\n${frontendNonce}\n${packageValue}\n`,
      privateKey,
    );
    return {
      appId,
      timeStamp: frontendTimestamp,
      nonceStr: frontendNonce,
      package: packageValue,
      signType: 'RSA',
      paySign,
    };
  }

  /** 调用微信支付退款 API；最终结果仍以微信退款通知为准。 */
  async createRefund(input: CreateProviderRefundInput): Promise<CreateProviderRefundResult> {
    const merchantId = this.required('WECHAT_PAY_MERCHANT_ID');
    const serialNo = this.required('WECHAT_PAY_MERCHANT_SERIAL_NO');
    const privateKey = await readFile(this.required('WECHAT_PAY_PRIVATE_KEY_PATH'), 'utf8');
    const path = '/v3/refund/domestic/refunds';
    const body = JSON.stringify({
      transaction_id: input.providerTradeNo,
      out_refund_no: input.refundNo.slice(0, 64),
      reason: input.reason.slice(0, 80),
      notify_url: this.required('WECHAT_PAY_REFUND_NOTIFY_URL'),
      amount: {
        refund: this.toCents(input.amount),
        total: this.toCents(input.originalAmount),
        currency: 'CNY',
      },
    });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = wechatNonce();
    const signature = signWechatMessage(
      wechatRequestMessage('POST', path, timestamp, nonce, body),
      privateKey,
    );
    const authorization =
      `WECHATPAY2-SHA256-RSA2048 mchid="${merchantId}",nonce_str="${nonce}",` +
      `timestamp="${timestamp}",serial_no="${serialNo}",signature="${signature}"`;
    const response = await fetch(`https://api.mch.weixin.qq.com${path}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: authorization,
      },
      body,
    });
    const payload = (await response.json()) as {
      refund_id?: string;
      status?: string;
      message?: string;
    };
    if (!response.ok || !payload.refund_id)
      throw new ConflictException(payload.message ?? 'WeChat Pay refund creation failed');
    return {
      providerRefundNo: payload.refund_id,
      eventId: `wechat-refund-accepted:${payload.refund_id}`,
      status: payload.status === 'SUCCESS' ? 'succeeded' : 'pending',
    };
  }

  private required(key: string): string {
    const value = process.env[key];
    if (!value) throw new ConflictException(`${key} is required for WeChat Pay`);
    return value;
  }

  private toCents(amount: string): number {
    const [whole, fraction = ''] = amount.split('.');
    const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0').slice(0, 2));
    if (!Number.isSafeInteger(cents) || cents <= 0)
      throw new ConflictException('WeChat Pay amount must be a positive cent value');
    return cents;
  }
}
