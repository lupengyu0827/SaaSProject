import { Injectable } from '@nestjs/common';
import type { CreateAuditLogRequest } from '@saas/contracts';

import { Prisma, type AuditLog } from '../../generated/prisma/index.js';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service.js';

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  create(input: CreateAuditLogRequest): Promise<AuditLog> {
    return this.prisma.auditLog.create({
      data: {
        tenantId: input.tenantId,
        actorId: input.actorId,
        actorType: input.actorType,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        requestId: input.requestId,
        ip: input.ip,
        userAgent: input.userAgent,
        diff: input.diff as Prisma.InputJsonValue | undefined,
      },
    });
  }
}
