/** 微信 jscode2session 适配器，密钥只从服务端环境变量读取。 */
import { BadGatewayException, Injectable } from '@nestjs/common';
import type {
  WechatIdentity,
  WechatIdentityPort,
} from '../../application/ports/wechat-identity.port.js';

interface WechatSessionPayload {
  openid?: string;
  unionid?: string;
  errcode?: number;
}

@Injectable()
export class WechatCodeExchangeAdapter implements WechatIdentityPort {
  /** 使用临时 code 向微信服务端交换稳定身份。 */
  async exchangeCode(code: string): Promise<WechatIdentity> {
    const appId = process.env.WECHAT_MINI_APP_ID;
    const appSecret = process.env.WECHAT_MINI_APP_SECRET;
    if (!appId || !appSecret) throw new Error('WeChat miniapp credentials are not configured');
    const query = new URLSearchParams({
      appid: appId,
      secret: appSecret,
      js_code: code,
      grant_type: 'authorization_code',
    });
    const response = await fetch(
      `https://api.weixin.qq.com/sns/jscode2session?${query.toString()}`,
    );
    const payload = (await response.json()) as WechatSessionPayload;
    if (!response.ok || payload.errcode || !payload.openid)
      throw new BadGatewayException('微信登录服务暂时不可用');
    return { openId: payload.openid, unionId: payload.unionid };
  }
}
