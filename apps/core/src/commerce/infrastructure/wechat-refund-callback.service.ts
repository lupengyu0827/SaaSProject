/** 微信退款通知适配器：验签、解密、解析租户路由并写入退款 Inbox。 */
import { readFile } from 'node:fs/promises';

import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';

import { RefundWebhookInboxService } from '../application/refund-webhook-inbox.service.js';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service.js';
import { decryptWechatResource, verifyWechatCallback } from './wechat-pay.crypto.js';
import type { WechatCallbackHeaders } from './wechat-pay-callback.service.js';

interface WechatRefundEnvelope {
  id: string;
  resource: {
    algorithm: string;
    ciphertext: string;
    nonce: string;
    associated_data?: string;
  };
}

interface WechatRefundResource {
  mchid: string;
  out_refund_no: string;
  refund_id: string;
  refund_status: string;
  amount: { refund: number; currency: string };
}

@Injectable()
export class WechatRefundCallbackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inbox: RefundWebhookInboxService,
  ) {}

  /** 验证并接收一条微信退款通知。 */
  async handle(headers: WechatCallbackHeaders, rawBody: string): Promise<void> {
    this.assertFreshTimestamp(headers.timestamp);
    if (headers.serial !== this.required('WECHAT_PAY_PLATFORM_SERIAL_NO'))
      throw new UnauthorizedException('Unknown WeChat Pay platform certificate');
    const publicKey = await readFile(this.required('WECHAT_PAY_PLATFORM_PUBLIC_KEY_PATH'), 'utf8');
    if (
      !verifyWechatCallback(headers.timestamp, headers.nonce, rawBody, headers.signature, publicKey)
    )
      throw new UnauthorizedException('Invalid WeChat Pay callback signature');

    const envelope = this.parse<WechatRefundEnvelope>(rawBody, 'refund callback envelope');
    if (envelope.resource.algorithm !== 'AEAD_AES_256_GCM')
      throw new BadRequestException('Unsupported WeChat Pay resource algorithm');
    const plaintext = decryptWechatResource(
      this.required('WECHAT_PAY_API_V3_KEY'),
      envelope.resource.nonce,
      envelope.resource.associated_data ?? '',
      envelope.resource.ciphertext,
    );
    const refund = this.parse<WechatRefundResource>(plaintext, 'refund resource');
    this.assertRefund(refund);
    const route = await this.prisma.providerCallbackRoute.findUnique({
      where: {
        channel_resourceType_externalNo: {
          channel: 'wechat_pay',
          resourceType: 'refund',
          externalNo: refund.out_refund_no,
        },
      },
    });
    if (!route) throw new BadRequestException('Unknown WeChat Pay refund number');
    await this.inbox.enqueue(route.tenantId, 'wechat_pay', envelope.id, {
      refundId: route.resourceId,
      providerRefundNo: refund.refund_id,
      refundedAmount: this.centsToAmount(refund.amount.refund),
      succeeded: refund.refund_status === 'SUCCESS',
      failureReason:
        refund.refund_status === 'SUCCESS'
          ? undefined
          : `WeChat Pay refund status: ${refund.refund_status}`,
    });
  }

  private assertFreshTimestamp(timestamp: string): void {
    const seconds = Number(timestamp);
    if (!Number.isSafeInteger(seconds) || Math.abs(Date.now() / 1000 - seconds) > 300)
      throw new UnauthorizedException('Stale WeChat Pay callback');
  }

  private assertRefund(refund: WechatRefundResource): void {
    if (
      !refund.out_refund_no ||
      !refund.refund_id ||
      refund.mchid !== this.required('WECHAT_PAY_MERCHANT_ID') ||
      refund.amount.currency !== 'CNY' ||
      !Number.isSafeInteger(refund.amount.refund) ||
      refund.amount.refund <= 0
    )
      throw new BadRequestException('Invalid WeChat Pay refund resource');
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
    if (!value) throw new Error(`${key} is required for WeChat Pay refund callback processing`);
    return value;
  }
}
