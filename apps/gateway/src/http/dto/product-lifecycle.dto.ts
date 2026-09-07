/** 商品生命周期运行时 DTO：版本和审计原因必须完整。 */
import type { ProductLifecycleCommandRequest } from '@saas/contracts';
import { IsInt, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class ProductLifecycleCommandDto implements ProductLifecycleCommandRequest {
  @IsInt()
  @Min(0)
  version!: number;

  @IsString()
  @MinLength(2)
  @MaxLength(500)
  reason!: string;
}
