ALTER TABLE "commerce"."brands"
  ADD COLUMN "english_name" VARCHAR(120),
  ADD COLUMN "initial" VARCHAR(1) NOT NULL DEFAULT '#';

CREATE INDEX "brands_tenant_id_initial_status_deleted_at_idx"
  ON "commerce"."brands"("tenant_id", "initial", "status", "deleted_at");

CREATE TABLE "commerce"."brand_categories" (
  "tenant_id" UUID NOT NULL,
  "brand_id" UUID NOT NULL,
  "category_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "brand_categories_pkey" PRIMARY KEY ("tenant_id", "brand_id", "category_id"),
  CONSTRAINT "brand_categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "platform"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "brand_categories_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "commerce"."brands"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "brand_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "commerce"."categories"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "brand_categories_tenant_id_category_id_brand_id_idx"
  ON "commerce"."brand_categories"("tenant_id", "category_id", "brand_id");

DROP INDEX "commerce"."brand_models_tenant_id_brand_id_name_key";
CREATE UNIQUE INDEX "brand_models_tenant_id_brand_id_series_id_name_key"
  ON "commerce"."brand_models"("tenant_id", "brand_id", "series_id", "name");
CREATE UNIQUE INDEX "brand_models_without_series_name_key"
  ON "commerce"."brand_models"("tenant_id", "brand_id", "name")
  WHERE "series_id" IS NULL;

INSERT INTO "commerce"."categories" ("tenant_id", "name", "sort_order")
SELECT "id", '腕表', 0 FROM "platform"."tenants"
ON CONFLICT ("tenant_id", "name") DO NOTHING;

ALTER TABLE "commerce"."brand_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "commerce"."brand_categories" FORCE ROW LEVEL SECURITY;
CREATE POLICY "brand_categories_tenant_isolation" ON "commerce"."brand_categories"
  FOR ALL
  USING ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid);
