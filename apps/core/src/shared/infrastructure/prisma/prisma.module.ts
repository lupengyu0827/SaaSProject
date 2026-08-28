import { Global, Module } from '@nestjs/common';

import { PrismaService } from './prisma.service.js';
import { GatewayCacheInvalidator } from '../gateway-cache-invalidator.service.js';

@Global()
@Module({
  providers: [PrismaService, GatewayCacheInvalidator],
  exports: [PrismaService, GatewayCacheInvalidator],
})
export class PrismaModule {}
