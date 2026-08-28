import type { TenantIsolationLevel } from '@saas/contracts';

export interface TenantDbContext {
  tenantId: string;
  isolationLevel: TenantIsolationLevel;
  connection: 'shared' | 'dedicated';
  schema: string;
  autoAppendTenantId: boolean;
  rlsEnabled: boolean;
  encryptedConnection?: string;
}
