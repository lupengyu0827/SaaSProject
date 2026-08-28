import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'saas:is-public';
export const REQUIRED_FEATURE = 'saas:required-feature';
export const QUOTA_METRIC = 'saas:quota-metric';
export const USAGE_METRIC = 'saas:usage-metric';
export const REQUIRED_PERMISSION = 'saas:required-permission';

export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC, true);
export const RequireFeature = (feature: string): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRED_FEATURE, feature);
export const EnforceQuota = (metric: string): MethodDecorator & ClassDecorator =>
  SetMetadata(QUOTA_METRIC, metric);
export const MeterUsage = (metric: string): MethodDecorator & ClassDecorator =>
  SetMetadata(USAGE_METRIC, metric);
export const RequirePermission = (permission: string): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRED_PERMISSION, permission);
