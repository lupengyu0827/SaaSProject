import { Inject, Injectable } from '@nestjs/common';
import type { CreateAuditLogRequest } from '@saas/contracts';

import { Prisma, type AuditLog } from '../../generated/prisma/index.js';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service.js';

@Injectable()
export class AuditLogService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  create(input: CreateAuditLogRequest): Promise<AuditLog> {
    return this.prisma.auditLog.create({
      data: {
        tenantId: input.tenantId,
        actorId: input.actorId,
        actorType: input.actorType,
        action: input.action.slice(0, 50),
        resourceType: input.resourceType.slice(0, 50),
        resourceId: input.resourceId?.slice(0, 100),
        requestId: input.requestId?.slice(0, 64),
        ip: input.ip,
        userAgent: input.userAgent,
        diff: input.diff as Prisma.InputJsonValue | undefined,
      },
    });
  }
}
