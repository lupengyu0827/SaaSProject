import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

import { PrismaPg } from '../../apps/core/node_modules/@prisma/adapter-pg';

import { Prisma, PrismaClient } from '../../apps/core/src/generated/prisma/index.js';

type Cell = string | number | null;
type SourceBrand = {
  id: number;
  name: string;
  englishName: string;
  initial: string;
  category: string;
};
type SourceSeries = { id: number; brandId: number; name: string; englishName: string };
type SourceModel = { id: number; seriesId: number; name: string };

const args = process.argv.slice(2);
const fileArg = option('--file');
const tenantId = option('--tenant-id');
const allTenants = args.includes('--all-tenants');
const apply = args.includes('--apply');

if (!fileArg) throw new Error('--file <xlsx> is required');
if (Boolean(tenantId) === allTenants)
  throw new Error('Specify exactly one of --tenant-id <uuid> or --all-tenants');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');

const source = readCatalog(resolve(fileArg));
const merged = mergeBrands(source.brands);
const summary = {
  sourceBrands: source.brands.length,
  mergedBrands: merged.brands.length,
  mergedBrandCount: source.brands.length - merged.brands.length,
  series: source.series.length,
  models: source.models.length,
};

if (!apply) {
  console.log(JSON.stringify({ mode: 'dry-run', ...summary }, null, 2));
  process.exit(0);
}

async function main(): Promise<void> {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 1 }) });
  try {
    const tenants = tenantId
      ? await prisma.tenant.findMany({
          where: { id: tenantId, status: 'active' },
          select: { id: true },
        })
      : await prisma.tenant.findMany({ where: { status: 'active' }, select: { id: true } });
    if (!tenants.length) throw new Error('No active target tenant found');

    for (const tenant of tenants) {
      await prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenant.id}, true)`;
          const categoryNames = [...new Set(source.brands.map((brand) => brand.category))];
          await tx.category.createMany({
            data: categoryNames.map((name, index) => ({
              tenantId: tenant.id,
              name,
              sortOrder: index,
            })),
            skipDuplicates: true,
          });
          const categories = await tx.category.findMany({
            where: { tenantId: tenant.id, name: { in: categoryNames }, deletedAt: null },
          });
          const categoryIdByName = new Map(categories.map((row) => [row.name, row.id]));

          const brandUuidBySourceId = new Map<number, string>();
          for (const brand of merged.brands) {
            const row = await tx.brand.upsert({
              where: { tenantId_name: { tenantId: tenant.id, name: brand.name } },
              update: {
                englishName: brand.englishName || null,
                initial: normalizeInitial(brand.initial),
                status: 'active',
                deletedAt: null,
              },
              create: {
                tenantId: tenant.id,
                name: brand.name,
                englishName: brand.englishName || null,
                initial: normalizeInitial(brand.initial),
              },
            });
            for (const sourceId of brand.sourceIds) brandUuidBySourceId.set(sourceId, row.id);
            await tx.brandCategory.createMany({
              data: brand.categories.map((name) => ({
                tenantId: tenant.id,
                brandId: row.id,
                categoryId: required(categoryIdByName, name, 'category'),
              })),
              skipDuplicates: true,
            });
          }

          const seriesUuidBySourceId = new Map<number, string>();
          for (const item of source.series) {
            const brandId = required(brandUuidBySourceId, item.brandId, 'brand');
            const row = await tx.brandSeries.upsert({
              where: {
                tenantId_brandId_name: { tenantId: tenant.id, brandId, name: item.name },
              },
              update: { status: 'active', deletedAt: null },
              create: { tenantId: tenant.id, brandId, name: item.name },
            });
            seriesUuidBySourceId.set(item.id, row.id);
          }

          const seriesBySourceId = new Map(source.series.map((item) => [item.id, item]));
          const sourceBrandById = new Map(source.brands.map((item) => [item.id, item]));
          for (const item of source.models) {
            const sourceSeries = required(seriesBySourceId, item.seriesId, 'source series');
            const sourceBrand = required(sourceBrandById, sourceSeries.brandId, 'source brand');
            const brandId = required(brandUuidBySourceId, sourceSeries.brandId, 'brand');
            const seriesId = required(seriesUuidBySourceId, item.seriesId, 'series');
            await tx.brandModel.upsert({
              where: {
                tenantId_brandId_seriesId_name: {
                  tenantId: tenant.id,
                  brandId,
                  seriesId,
                  name: item.name,
                },
              },
              update: {
                categoryId: required(categoryIdByName, sourceBrand.category, 'category'),
                status: 'active',
                deletedAt: null,
              },
              create: {
                tenantId: tenant.id,
                brandId,
                seriesId,
                categoryId: required(categoryIdByName, sourceBrand.category, 'category'),
                name: item.name,
              },
            });
          }

          await tx.auditLog.create({
            data: {
              tenantId: tenant.id,
              actorType: 'system',
              action: 'brand_catalog.imported',
              resourceType: 'brand_catalog',
              diff: summary,
            },
          });
          await tx.domainEventOutbox.create({
            data: {
              tenantId: tenant.id,
              aggregateType: 'brand_catalog',
              aggregateId: tenant.id,
              eventType: 'brand_catalog.imported',
              payload: summary,
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120_000 },
      );
      console.log(JSON.stringify({ mode: 'applied', tenantId: tenant.id, ...summary }));
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

function option(name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function required<K, V>(map: Map<K, V>, key: K, label: string): V {
  const value = map.get(key);
  if (value === undefined) throw new Error(`Missing ${label} mapping for ${String(key)}`);
  return value;
}

function normalize(value: string): string {
  return value.normalize('NFKC').trim().toLocaleLowerCase('en-US');
}

function normalizeInitial(value: string): string {
  const initial = value.normalize('NFKC').trim().toUpperCase();
  return /^[A-Z]$/.test(initial) ? initial : '#';
}

function mergeBrands(brands: SourceBrand[]) {
  const grouped = new Map<string, SourceBrand[]>();
  for (const brand of brands) {
    const key = normalize(brand.englishName) || normalize(brand.name);
    grouped.set(key, [...(grouped.get(key) ?? []), brand]);
  }
  return {
    brands: [...grouped.values()].map((entries) => {
      const canonical = [...entries].sort(
        (left, right) => left.name.length - right.name.length || left.id - right.id,
      )[0]!;
      return {
        name: canonical.name,
        englishName: canonical.englishName,
        initial: canonical.initial,
        categories: [...new Set(entries.map((entry) => entry.category))],
        sourceIds: entries.map((entry) => entry.id),
      };
    }),
  };
}

function readCatalog(file: string): {
  brands: SourceBrand[];
  series: SourceSeries[];
  models: SourceModel[];
} {
  const strings = parseSharedStrings(readZip(file, 'xl/sharedStrings.xml'));
  const brandRows = parseSheet(readZip(file, 'xl/worksheets/sheet2.xml'), strings);
  const seriesRows = parseSheet(readZip(file, 'xl/worksheets/sheet3.xml'), strings);
  const modelRows = parseSheet(readZip(file, 'xl/worksheets/sheet4.xml'), strings);
  return {
    brands: brandRows.slice(1).map((row) => ({
      id: number(row[0]),
      name: text(row[1]),
      englishName: text(row[2]),
      initial: text(row[3]),
      category: text(row[4]),
    })),
    series: seriesRows.slice(1).map((row) => ({
      id: number(row[0]),
      brandId: number(row[1]),
      name: text(row[3]),
      englishName: optionalText(row[4]),
    })),
    models: modelRows.slice(1).map((row) => ({
      id: number(row[0]),
      seriesId: number(row[1]),
      name: text(row[4]),
    })),
  };
}

function readZip(file: string, entry: string): string {
  return execFileSync('unzip', ['-p', file, entry], { encoding: 'utf8', maxBuffer: 20_000_000 });
}

function parseSharedStrings(xml: string): string[] {
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) =>
    [...match[1]!.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)]
      .map((part) => decodeXml(part[1]!))
      .join(''),
  );
}

function parseSheet(xml: string, strings: string[]): Cell[][] {
  return [...xml.matchAll(/<row(?:\s[^>]*)?>([\s\S]*?)<\/row>/g)].map((rowMatch) => {
    const row: Cell[] = [];
    for (const cellMatch of rowMatch[1]!.matchAll(/<c\s([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attributes = cellMatch[1]!;
      const body = cellMatch[2]!;
      const reference = /\br="([A-Z]+)\d+"/.exec(attributes)?.[1];
      if (!reference) continue;
      const index = columnIndex(reference);
      const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      const type = /\bt="([^"]+)"/.exec(attributes)?.[1];
      row[index] = raw === undefined ? null : type === 's' ? strings[Number(raw)]! : Number(raw);
    }
    return row;
  });
}

function columnIndex(reference: string): number {
  return [...reference].reduce((value, letter) => value * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

function decodeXml(value: string): string {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'");
}

function text(value: Cell): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Expected non-empty text cell');
  return value.normalize('NFKC').trim();
}

function optionalText(value: Cell): string {
  return typeof value === 'string' ? value.normalize('NFKC').trim() : '';
}

function number(value: Cell): number {
  if (typeof value !== 'number' || !Number.isInteger(value))
    throw new Error('Expected integer cell');
  return value;
}
