import { Injectable } from '@nestjs/common';
import type { ActorPermissionsResponse } from '@saas/contracts';

import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service.js';

@Injectable()
export class RbacService {
  constructor(private readonly prisma: PrismaService) {}

  async getActorPermissions(tenantId: string, actorId: string): Promise<ActorPermissionsResponse> {
    const assignments = await this.prisma.userRole.findMany({
      where: { userId: actorId, user: { tenantId, status: 'active' } },
      select: {
        role: {
          select: { permissions: { select: { permission: { select: { key: true } } } } },
        },
      },
    });
    const permissions = [
      ...new Set(
        assignments.flatMap(({ role }) => role.permissions.map(({ permission }) => permission.key)),
      ),
    ];
    return { tenantId, actorId, permissions };
  }
}
