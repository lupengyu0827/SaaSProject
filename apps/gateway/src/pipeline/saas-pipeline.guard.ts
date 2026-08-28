import { CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { GatewayPolicyEngine } from './gateway-policy.engine.js';
import {
  IS_PUBLIC,
  QUOTA_METRIC,
  REQUIRED_FEATURE,
  REQUIRED_PERMISSION,
} from './pipeline.metadata.js';
import { RbacClient } from './rbac.client.js';
import { AuthTokenVerifier } from './auth-token.verifier.js';
import type { SaasRequest } from './request-context.js';
import { TenantStateClient } from './tenant-state.client.js';

@Injectable()
export class SaasPipelineGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly stateClient: TenantStateClient,
    private readonly policy: GatewayPolicyEngine,
    private readonly rbac: RbacClient,
    private readonly tokens: AuthTokenVerifier,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      return true;
    }

    const request = context.switchToHttp().getRequest<SaasRequest>();
    const tenantId = request.header('x-tenant-id');
    if (!tenantId) return false;

    request.tenantId = tenantId;
    const claims = this.tokens.verify(request.header('authorization'), tenantId);
    request.actor = { id: claims.sub, type: claims.actorType };
    request.tenantState = await this.stateClient.get(tenantId);
    this.policy.enforce(request.tenantState, {
      method: request.method,
      requiredFeature: this.reflector.getAllAndOverride<string>(REQUIRED_FEATURE, [
        context.getHandler(),
        context.getClass(),
      ]),
      quotaMetric: this.reflector.getAllAndOverride<string>(QUOTA_METRIC, [
        context.getHandler(),
        context.getClass(),
      ]),
    });
    await this.rbac.enforce(
      tenantId,
      request.actor.id,
      this.reflector.getAllAndOverride<string>(REQUIRED_PERMISSION, [
        context.getHandler(),
        context.getClass(),
      ]),
    );
    return true;
  }
}
