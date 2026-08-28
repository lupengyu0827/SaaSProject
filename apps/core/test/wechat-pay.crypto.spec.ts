import { createCipheriv, generateKeyPairSync, sign, verify } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  decryptWechatResource,
  signWechatMessage,
  verifyWechatCallback,
  wechatRequestMessage,
} from '../src/commerce/infrastructure/wechat-pay.crypto.js';

describe('WeChat Pay v3 cryptography', () => {
  const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const privateKey = keys.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const publicKey = keys.publicKey.export({ type: 'spki', format: 'pem' }).toString();

  it('signs the canonical HTTP request message with RSA-SHA256', () => {
    const message = wechatRequestMessage('post', '/v3/pay/transactions/jsapi', '1', 'nonce', '{}');
    const signature = signWechatMessage(message, privateKey);
    expect(
      verify('RSA-SHA256', Buffer.from(message), publicKey, Buffer.from(signature, 'base64')),
    ).toBe(true);
  });

  it('verifies callback signatures over the exact raw body', () => {
    const body = '{"id":"event-1"}';
    const message = `1\nnonce\n${body}\n`;
    const signature = sign('RSA-SHA256', Buffer.from(message), privateKey).toString('base64');
    expect(verifyWechatCallback('1', 'nonce', body, signature, publicKey)).toBe(true);
    expect(verifyWechatCallback('1', 'nonce', `${body} `, signature, publicKey)).toBe(false);
  });

  it('decrypts AEAD_AES_256_GCM callback resources', () => {
    const key = '0123456789abcdef0123456789abcdef';
    const nonce = '0123456789ab';
    const associatedData = 'transaction';
    const plaintext = '{"trade_state":"SUCCESS"}';
    const cipher = createCipheriv('aes-256-gcm', Buffer.from(key), Buffer.from(nonce));
    cipher.setAAD(Buffer.from(associatedData));
    const encrypted = Buffer.concat([
      cipher.update(plaintext),
      cipher.final(),
      cipher.getAuthTag(),
    ]).toString('base64');
    expect(decryptWechatResource(key, nonce, associatedData, encrypted)).toBe(plaintext);
  });
});
