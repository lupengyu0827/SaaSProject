/** Gateway 响应信封解析单测：成功/失败/裸对象三种情况。 */
import { describe, expect, it } from 'vitest';

import { isErrorEnvelope, isSuccessEnvelope, unwrapApiData } from './envelope';

describe('envelope', () => {
  it('识别成功信封并解出业务数据', () => {
    const payload = {
      code: 0,
      message: 'ok',
      data: { id: 'p-1', name: '测试商品' },
      traceId: 't-1',
    };
    expect(isSuccessEnvelope(payload)).toBe(true);
    expect(unwrapApiData(payload)).toEqual({ id: 'p-1', name: '测试商品' });
  });

  it('识别失败信封', () => {
    const payload = { code: 40100, message: '账号或密码不正确', data: null, traceId: 't-2' };
    expect(isErrorEnvelope(payload)).toBe(true);
    expect(isSuccessEnvelope(payload)).toBe(false);
  });

  it('兼容未包装的裸对象：原样返回', () => {
    const raw = { id: 'p-2', status: 'draft' };
    expect(isSuccessEnvelope(raw)).toBe(false);
    expect(isErrorEnvelope(raw)).toBe(false);
    expect(unwrapApiData(raw)).toEqual(raw);
  });

  it('对非对象输入不误判', () => {
    expect(isSuccessEnvelope(null)).toBe(false);
    expect(isSuccessEnvelope('string')).toBe(false);
    expect(isErrorEnvelope(undefined)).toBe(false);
    expect(unwrapApiData(null)).toBeNull();
  });
});
