import { Injectable } from '@nestjs/common';

@Injectable()
export class GatewayCacheInvalidator {
  async invalidateTenant(tenantId: string): Promise<void> {
    const gatewayBaseUrl = process.env.GATEWAY_BASE_URL ?? 'http://localhost:3100';
    try {
      await fetch(`${gatewayBaseUrl}/api/internal/cache/tenants/${tenantId}`, {
        method: 'DELETE',
        headers: { 'x-internal-key': process.env.INTERNAL_API_KEY ?? 'local-internal-key' },
      });
    } catch {
      // Gateway cache also has a 30-second TTL, so a temporary outage cannot leave stale state forever.
    }
  }
}
