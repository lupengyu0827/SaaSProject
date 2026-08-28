import { describe, expect, it } from 'vitest';

import { hashPassword, verifyPassword } from '../src/auth/password-hasher.js';

describe('password hashing', () => {
  it('verifies the correct password and rejects a different one', async () => {
    const encoded = await hashPassword('correct-horse-battery-staple');
    await expect(verifyPassword('correct-horse-battery-staple', encoded)).resolves.toBe(true);
    await expect(verifyPassword('wrong-password', encoded)).resolves.toBe(false);
  });
});
