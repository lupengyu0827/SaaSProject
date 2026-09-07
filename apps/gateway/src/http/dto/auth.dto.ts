/** Gateway 认证入口运行时 DTO；与共享契约保持结构兼容。 */
import type {
  LoginRequest,
  MerchantLoginRequest,
  MiniappLoginRequest,
  RefreshSessionRequest,
} from '@saas/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class MiniappLoginDto implements MiniappLoginRequest {
  @ApiProperty({ description: 'uni.login 获取的一次性登录凭证', example: '0a3f...' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  code!: string;
}

export class MerchantLoginDto implements MerchantLoginRequest {
  @ApiProperty({ description: '商家账号邮箱', example: 'owner@example.com' })
  @IsEmail()
  @MaxLength(200)
  email!: string;

  @ApiProperty({ description: '商家账号密码', minLength: 8, maxLength: 128 })
  @IsString()
  @Length(8, 128)
  password!: string;

  @ApiPropertyOptional({ description: '店铺子域；账号可自动识别店铺时可省略' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  subdomain?: string;
}

export class AdminLoginDto implements LoginRequest {
  @ApiProperty({ description: '店铺子域', example: 'demo-shop' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  subdomain!: string;

  @ApiProperty({ description: '管理员邮箱', example: 'admin@example.com' })
  @IsEmail()
  @MaxLength(200)
  email!: string;

  @ApiProperty({ description: '管理员密码', minLength: 8, maxLength: 128 })
  @IsString()
  @Length(8, 128)
  password!: string;
}

export class RefreshSessionDto implements RefreshSessionRequest {
  @ApiProperty({ description: '登录或上次刷新签发的 Refresh Token' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  refreshToken!: string;
}
