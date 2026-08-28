import { Body, Controller, Post } from '@nestjs/common';
import type { CreateAuditLogRequest } from '@saas/contracts';

import { AuditLogService } from '../application/audit-log.service.js';

@Controller('internal/audit-logs')
export class AuditController {
  constructor(private readonly audit: AuditLogService) {}

  @Post()
  async create(@Body() input: CreateAuditLogRequest): Promise<{ accepted: true }> {
    await this.audit.create(input);
    return { accepted: true };
  }
}
