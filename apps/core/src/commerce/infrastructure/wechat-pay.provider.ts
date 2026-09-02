import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

import { ConflictException, Injectable } from '@nestjs/common';

import type {
  CreateProviderPaymentInput,
  CreateProviderRefundInput,
  CreateProviderRefundResult,
  PaymentProvider,
  QueryProviderPaymentInput,
  QueryProviderPaymentResult,
  ProviderTradeBillEntry,
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

  /** 按商户订单号主动查询微信支付状态，用于补偿遗漏回调。 */
  async queryPayment(input: QueryProviderPaymentInput): Promise<QueryProviderPaymentResult> {
    const merchantId = this.required('WECHAT_PAY_MERCHANT_ID');
    const canonicalUrl = `/v3/pay/transactions/out-trade-no/${encodeURIComponent(input.paymentNo)}?mchid=${encodeURIComponent(merchantId)}`;
    const response = await fetch(`https://api.mch.weixin.qq.com${canonicalUrl}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: await this.authorization('GET', canonicalUrl, ''),
      },
    });
    const payload = (await response.json()) as {
      transaction_id?: string;
      trade_state?: string;
      trade_state_desc?: string;
      amount?: { total?: number };
      message?: string;
    };
    if (!response.ok) throw new ConflictException(payload.message ?? 'WeChat Pay query failed');
    const status = this.paymentQueryStatus(payload.trade_state);
    return {
      status,
      providerTradeNo: payload.transaction_id,
      paidAmount:
        payload.amount?.total === undefined ? undefined : (payload.amount.total / 100).toFixed(2),
      failureReason:
        status === 'failed' ? (payload.trade_state_desc ?? payload.trade_state) : undefined,
    };
  }

  /** 下载并校验微信日交易账单，仅返回成功支付明细。 */
  async downloadTradeBill(billDate: string): Promise<ProviderTradeBillEntry[]> {
    const requestPath = `/v3/bill/tradebill?bill_date=${encodeURIComponent(billDate)}&bill_type=SUCCESS`;
    const response = await fetch(`https://api.mch.weixin.qq.com${requestPath}`, {
      headers: {
        Accept: 'application/json',
        Authorization: await this.authorization('GET', requestPath, ''),
      },
    });
    const metadata = (await response.json()) as {
      download_url?: string;
      hash_type?: string;
      hash_value?: string;
      message?: string;
    };
    if (!response.ok || !metadata.download_url || !metadata.hash_value)
      throw new ConflictException(metadata.message ?? 'WeChat trade bill request failed');
    if (metadata.hash_type !== 'SHA1') throw new ConflictException('Unsupported WeChat bill hash');
    const url = new URL(metadata.download_url);
    if (url.protocol !== 'https:' || url.hostname !== 'api.mch.weixin.qq.com')
      throw new ConflictException('Invalid WeChat bill download URL');
    const download = await fetch(url, {
      headers: {
        Authorization: await this.authorization('GET', `${url.pathname}${url.search}`, ''),
      },
    });
    const content = await download.text();
    if (!download.ok) throw new ConflictException('WeChat trade bill download failed');
    const digest = createHash('sha1').update(content).digest('hex');
    if (digest.toLowerCase() !== metadata.hash_value.toLowerCase())
      throw new ConflictException('WeChat trade bill integrity check failed');
    return this.parseTradeBill(content);
  }

  private parseTradeBill(content: string): ProviderTradeBillEntry[] {
    const lines = content
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .filter(Boolean);
    const headerIndex = lines.findIndex(
      (line) => line.includes('商户订单号') && line.includes('微信订单号'),
    );
    if (headerIndex < 0) throw new ConflictException('WeChat trade bill header was not found');
    const headers = this.csvColumns(lines[headerIndex] ?? '').map((column) =>
      column.replace(/^`/, ''),
    );
    const paymentNoIndex = headers.indexOf('商户订单号');
    const tradeNoIndex = headers.indexOf('微信订单号');
    const amountIndex = headers.findIndex((header) =>
      ['订单金额', '应结订单金额'].includes(header),
    );
    if ([paymentNoIndex, tradeNoIndex, amountIndex].some((index) => index < 0))
      throw new ConflictException('WeChat trade bill columns are incomplete');
    return lines
      .slice(headerIndex + 1)
      .filter((line) => !line.startsWith('总交易单数'))
      .map((line) => this.csvColumns(line).map((column) => column.replace(/^`/, '')))
      .filter((columns) => columns.length === headers.length)
      .map((columns) => ({
        paymentNo: columns[paymentNoIndex] ?? '',
        providerTradeNo: columns[tradeNoIndex] ?? '',
        amount: columns[amountIndex] ?? '',
      }))
      .filter((entry) => entry.paymentNo && entry.providerTradeNo && entry.amount);
  }

  private csvColumns(line: string): string[] {
    const columns: string[] = [];
    let current = '';
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const character = line[index];
      if (character === '"') quoted = !quoted;
      else if (character === ',' && !quoted) {
        columns.push(current.trim());
        current = '';
      } else current += character;
    }
    columns.push(current.trim());
    return columns;
  }

  private async authorization(method: string, canonicalUrl: string, body: string): Promise<string> {
    const merchantId = this.required('WECHAT_PAY_MERCHANT_ID');
    const serialNo = this.required('WECHAT_PAY_MERCHANT_SERIAL_NO');
    const privateKey = await readFile(this.required('WECHAT_PAY_PRIVATE_KEY_PATH'), 'utf8');
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = wechatNonce();
    const signature = signWechatMessage(
      wechatRequestMessage(method, canonicalUrl, timestamp, nonce, body),
      privateKey,
    );
    return (
      `WECHATPAY2-SHA256-RSA2048 mchid="${merchantId}",nonce_str="${nonce}",` +
      `timestamp="${timestamp}",serial_no="${serialNo}",signature="${signature}"`
    );
  }

  private paymentQueryStatus(state?: string): QueryProviderPaymentResult['status'] {
    if (state === 'SUCCESS') return 'succeeded';
    if (['CLOSED', 'REVOKED', 'PAYERROR'].includes(state ?? '')) return 'failed';
    return 'pending';
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
