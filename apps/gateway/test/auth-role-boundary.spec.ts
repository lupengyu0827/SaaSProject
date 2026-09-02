/** Gateway 认证入口角色边界测试。 */
import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { AdminAuthController } from '../src/auth/admin-auth.controller.js';
import { MerchantAuthController } from '../src/auth/merchant-auth.controller.js';
import type { SaasRequest } from '../src/pipeline/request-context.js';

function createRequest(actorType: NonNullable<SaasRequest['actor']>['type']): SaasRequest {
  return {
    tenantId: 'tenant-a',
    actor: { id: 'actor-a', type: actorType },
  } as SaasRequest;
}

describe('authentication role boundaries', () => {
  it('rejects a customer token from the merchant session endpoint', () => {
    expect(() => new MerchantAuthController().session(createRequest('customer'))).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a merchant token from the legacy admin session endpoint', () => {
    expect(() => new AdminAuthController().session(createRequest('merchant_owner'))).toThrow(
      UnauthorizedException,
    );
  });
});
