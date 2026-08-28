import type { TenantAccessState } from '@saas/contracts';
import type { Request } from 'express';

export interface AuthenticatedActor {
  id: string;
  type: 'admin_user' | 'customer' | 'api_client';
}

export interface SaasRequest extends Request {
  tenantId?: string;
  actor?: AuthenticatedActor;
  tenantState?: TenantAccessState;
}
