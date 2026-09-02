import type { ActorType, TenantAccessState } from '@saas/contracts';
import type { Request } from 'express';

export interface AuthenticatedActor {
  id: string;
  type: ActorType | 'api_client';
}

export interface SaasRequest extends Request {
  tenantId?: string;
  actor?: AuthenticatedActor;
  tenantState?: TenantAccessState;
}
