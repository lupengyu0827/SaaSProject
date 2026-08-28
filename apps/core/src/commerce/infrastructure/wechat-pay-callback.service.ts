import { readFile } from 'node:fs/promises';

import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';

import { PaymentWebhookInboxService } from '../application/payment-webhook-inbox.service.js';
import { decryptWechatResource, verifyWechatCallback } from './wechat-pay.crypto.js';

interface WechatCallbackEnvelope {
  id: string;
  resource: {
    algorithm: string;
    ciphertext: string;
    nonce: string;
    associated_data?: string;
  };
}

interface WechatTransaction {
  mchid: string;
  out_trade_no: string;
  transaction_id: string;
  trade_state: string;
  attach: string;
  success_time?: string;
  amount: { total: number; currency: string };
}

interface WechatAttach {
  tenantId: string;
  paymentId: string;
}

export interface WechatCallbackHeaders {
  timestamp: string;
  nonce: string;
  signature: string;
  serial: string;
}

@Injectable()
export class WechatPayCallbackService {
  constructor(private readonly inbox: PaymentWebhookInboxService) {}

  async handle(headers: WechatCallbackHeaders, rawBody: string): Promise<void> {
    this.assertFreshTimestamp(headers.timestamp);
    const expectedSerial = this.required('WECHAT_PAY_PLATFORM_SERIAL_NO');
    if (headers.serial !== expectedSerial)
      throw new UnauthorizedException('Unknown WeChat Pay platform certificate');
    const publicKey = await readFile(this.required('WECHAT_PAY_PLATFORM_PUBLIC_KEY_PATH'), 'utf8');
    if (
      !verifyWechatCallback(headers.timestamp, headers.nonce, rawBody, headers.signature, publicKey)
    )
      throw new UnauthorizedException('Invalid WeChat Pay callback signature');

    const envelope = this.parse<WechatCallbackEnvelope>(rawBody, 'callback envelope');
    if (envelope.resource.algorithm !== 'AEAD_AES_256_GCM')
      throw new BadRequestException('Unsupported WeChat Pay resource algorithm');
    const plaintext = decryptWechatResource(
      this.required('WECHAT_PAY_API_V3_KEY'),
      envelope.resource.nonce,
      envelope.resource.associated_data ?? '',
      envelope.resource.ciphertext,
    );
    const transaction = this.parse<WechatTransaction>(plaintext, 'transaction resource');
    const attach = this.parse<WechatAttach>(transaction.attach, 'transaction attach');
    this.assertTransaction(transaction, attach);

    await this.inbox.enqueue(attach.tenantId, 'wechat_pay', envelope.id, {
      paymentId: attach.paymentId,
      paymentNo: transaction.out_trade_no,
      paidAmount: this.centsToAmount(transaction.amount.total),
      providerTradeNo: transaction.transaction_id,
      succeeded: transaction.trade_state === 'SUCCESS',
      failureReason:
        transaction.trade_state === 'SUCCESS'
          ? undefined
          : `WeChat Pay trade state: ${transaction.trade_state}`,
    });
  }

  private assertFreshTimestamp(timestamp: string): void {
    const seconds = Number(timestamp);
    if (!Number.isSafeInteger(seconds) || Math.abs(Date.now() / 1000 - seconds) > 300)
      throw new UnauthorizedException('Stale WeChat Pay callback');
  }

  private assertTransaction(transaction: WechatTransaction, attach: WechatAttach): void {
    if (
      !attach.tenantId ||
      !attach.paymentId ||
      transaction.mchid !== this.required('WECHAT_PAY_MERCHANT_ID') ||
      transaction.amount.currency !== 'CNY' ||
      !Number.isSafeInteger(transaction.amount.total) ||
      transaction.amount.total <= 0
    )
      throw new BadRequestException('Invalid WeChat Pay transaction resource');
  }

  private centsToAmount(cents: number): string {
    return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
  }

  private parse<T>(value: string, label: string): T {
    try {
      return JSON.parse(value) as T;
    } catch {
      throw new BadRequestException(`Invalid WeChat Pay ${label}`);
    }
  }

  private required(key: string): string {
    const value = process.env[key];
    if (!value) throw new Error(`${key} is required for WeChat Pay callback processing`);
    return value;
  }
}
