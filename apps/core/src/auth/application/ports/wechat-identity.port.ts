/** 微信身份交换端口，隔离微信 API 的具体实现。 */
export const WECHAT_IDENTITY_PORT = Symbol('WECHAT_IDENTITY_PORT');
export interface WechatIdentity {
  openId: string;
  unionId?: string;
}
export interface WechatIdentityPort {
  exchangeCode(code: string): Promise<WechatIdentity>;
}
