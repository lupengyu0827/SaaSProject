import {
  createDecipheriv,
  createPrivateKey,
  createPublicKey,
  randomBytes,
  sign,
  verify,
} from 'node:crypto';

export function wechatRequestMessage(
  method: string,
  canonicalUrl: string,
  timestamp: string,
  nonce: string,
  body: string,
): string {
  return `${method.toUpperCase()}\n${canonicalUrl}\n${timestamp}\n${nonce}\n${body}\n`;
}

export function signWechatMessage(message: string, privateKeyPem: string): string {
  return sign('RSA-SHA256', Buffer.from(message), createPrivateKey(privateKeyPem)).toString(
    'base64',
  );
}

export function verifyWechatCallback(
  timestamp: string,
  nonce: string,
  body: string,
  signature: string,
  platformPublicKeyPem: string,
): boolean {
  const message = `${timestamp}\n${nonce}\n${body}\n`;
  return verify(
    'RSA-SHA256',
    Buffer.from(message),
    createPublicKey(platformPublicKeyPem),
    Buffer.from(signature, 'base64'),
  );
}

export function decryptWechatResource(
  apiV3Key: string,
  nonce: string,
  associatedData: string,
  ciphertext: string,
): string {
  const key = Buffer.from(apiV3Key, 'utf8');
  if (key.length !== 32) throw new Error('WECHAT_PAY_API_V3_KEY must contain exactly 32 bytes');
  const encrypted = Buffer.from(ciphertext, 'base64');
  if (encrypted.length <= 16) throw new Error('Invalid WeChat Pay ciphertext');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(nonce, 'utf8'));
  decipher.setAAD(Buffer.from(associatedData, 'utf8'));
  decipher.setAuthTag(encrypted.subarray(-16));
  return Buffer.concat([decipher.update(encrypted.subarray(0, -16)), decipher.final()]).toString(
    'utf8',
  );
}

export function wechatNonce(): string {
  return randomBytes(16).toString('hex');
}
