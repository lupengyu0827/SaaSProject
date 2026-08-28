import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../../apps/core/src/generated/prisma/index.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required to seed the database');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 1 }) });

const plans = [
  {
    code: 'free',
    name: '免费版',
    description: '适合验证业务，提供基础商品能力',
    priceMonthly: '0',
    priceYearly: '0',
    isolationLevel: 'logical',
    trialDays: 0,
    features: ['products.basic', 'orders.basic'],
    quotas: { products: 50, staffs: 2, storage_bytes: 1_073_741_824, api_calls: 10_000 },
    sortOrder: 10,
  },
  {
    code: 'basic',
    name: '基础版',
    description: '适合小型商家日常经营',
    priceMonthly: '299',
    priceYearly: '2990',
    isolationLevel: 'logical',
    trialDays: 14,
    features: ['products.basic', 'orders.basic', 'marketing.basic'],
    quotas: { products: 500, staffs: 10, storage_bytes: 10_737_418_240, api_calls: 100_000 },
    sortOrder: 20,
  },
  {
    code: 'pro',
    name: '专业版',
    description: '提供高级报表、自定义字段与专属 Schema',
    priceMonthly: '999',
    priceYearly: '9990',
    isolationLevel: 'schema',
    trialDays: 14,
    features: [
      'products.basic',
      'orders.basic',
      'marketing.basic',
      'reports.advanced',
      'products.custom_fields',
    ],
    quotas: { products: 10_000, staffs: 50, storage_bytes: 107_374_182_400, api_calls: 1_000_000 },
    sortOrder: 30,
  },
  {
    code: 'enterprise',
    name: '旗舰版',
    description: '物理隔离、开放 API 与企业级服务保障',
    priceMonthly: '4999',
    priceYearly: '49990',
    isolationLevel: 'physical',
    trialDays: 30,
    features: ['*'],
    quotas: { products: -1, staffs: -1, storage_bytes: -1, api_calls: -1 },
    sortOrder: 40,
  },
] as const;

const permissions = [
  ['reports.read', '查看经营报表'],
  ['reports.refresh', '刷新高级报表'],
  ['products.read', '查看商品'],
  ['products.write', '管理商品'],
  ['orders.read', '查看订单'],
  ['orders.write', '管理订单'],
  ['shipments.read', '查看物流单'],
  ['shipments.write', '创建物流单'],
  ['refunds.read', '查看退款申请'],
  ['refunds.write', '提交退款申请'],
  ['refunds.review', '审核退款申请'],
  ['refunds.execute', '执行渠道退款'],
  ['refunds.confirm', '确认渠道退款结果'],
  ['tenant.settings', '管理租户设置'],
  ['rbac.manage', '管理角色与权限'],
  ['inventory.read', '查看库存'],
  ['inventory.write', '管理库存流水'],
  ['payments.read', '查看支付单'],
  ['payments.write', '创建与确认支付'],
] as const;

async function main(): Promise<void> {
  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { code: plan.code },
      update: plan,
      create: plan,
    });
  }
  for (const [key, description] of permissions) {
    await prisma.permission.upsert({
      where: { key },
      update: { description },
      create: { key, description },
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
