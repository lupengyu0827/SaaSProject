import { Module } from '@nestjs/common';

import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { CustomerAuthService } from './application/customer-auth.service.js';
import { WECHAT_IDENTITY_PORT } from './application/ports/wechat-identity.port.js';
import { CUSTOMER_AUTH_REPOSITORY } from './domain/ports/customer-auth.repository.port.js';
import { WechatCodeExchangeAdapter } from './infrastructure/adapters/wechat-code-exchange.adapter.js';
import { PrismaCustomerAuthRepository } from './infrastructure/repositories/prisma-customer-auth.repository.js';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    CustomerAuthService,
    { provide: WECHAT_IDENTITY_PORT, useClass: WechatCodeExchangeAdapter },
    { provide: CUSTOMER_AUTH_REPOSITORY, useClass: PrismaCustomerAuthRepository },
  ],
})
export class AuthModule {}
