CREATE TABLE "commerce"."brand_series" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "tenant_id" UUID NOT NULL,
  "brand_id" UUID NOT NULL, "name" VARCHAR(100) NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'active', "version" INTEGER NOT NULL DEFAULT 0,
  "deleted_at" TIMESTAMPTZ(6), "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "brand_series_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "brand_series_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "platform"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "brand_series_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "commerce"."brands"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "brand_series_tenant_id_brand_id_name_key" ON "commerce"."brand_series"("tenant_id", "brand_id", "name");
CREATE INDEX "brand_series_tenant_id_brand_id_status_deleted_at_idx" ON "commerce"."brand_series"("tenant_id", "brand_id", "status", "deleted_at");

CREATE TABLE "commerce"."brand_models" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "tenant_id" UUID NOT NULL,
  "brand_id" UUID NOT NULL, "series_id" UUID, "category_id" UUID,
  "name" VARCHAR(120) NOT NULL, "official_guide_price" DECIMAL(12,2),
  "default_material" VARCHAR(100), "status" VARCHAR(20) NOT NULL DEFAULT 'active',
  "version" INTEGER NOT NULL DEFAULT 0, "deleted_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "brand_models_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "brand_models_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "platform"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "brand_models_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "commerce"."brands"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "brand_models_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "commerce"."brand_series"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "brand_models_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "commerce"."categories"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "brand_models_tenant_id_brand_id_name_key" ON "commerce"."brand_models"("tenant_id", "brand_id", "name");
CREATE INDEX "brand_models_tenant_id_brand_id_series_id_status_deleted_at_idx" ON "commerce"."brand_models"("tenant_id", "brand_id", "series_id", "status", "deleted_at");

CREATE TABLE "commerce"."recycling_types" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "tenant_id" UUID NOT NULL,
  "name" VARCHAR(50) NOT NULL, "sort_order" INTEGER NOT NULL DEFAULT 0,
  "status" VARCHAR(20) NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "recycling_types_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "recycling_types_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "platform"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "recycling_types_tenant_id_name_key" ON "commerce"."recycling_types"("tenant_id", "name");
CREATE INDEX "recycling_types_tenant_id_status_sort_order_idx" ON "commerce"."recycling_types"("tenant_id", "status", "sort_order");

CREATE TABLE "commerce"."product_intakes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "tenant_id" UUID NOT NULL,
  "product_id" UUID NOT NULL, "idempotency_key" VARCHAR(100) NOT NULL,
  "request_fingerprint" VARCHAR(64) NOT NULL, "action" VARCHAR(30) NOT NULL,
  "custom_tips" VARCHAR(250), "condition" VARCHAR(20) NOT NULL,
  "series_id" UUID, "model_id" UUID, "official_guide_price" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "ownership_type" VARCHAR(20), "stock_quantity" INTEGER NOT NULL,
  "inventory_age_warning_days" INTEGER NOT NULL DEFAULT 90,
  "total_cost_price" DECIMAL(12,2) NOT NULL DEFAULT 0, "peer_price" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "agent_price" DECIMAL(12,2) NOT NULL DEFAULT 0, "appraiser_employee_id" UUID NOT NULL,
  "appraiser_name" VARCHAR(100) NOT NULL, "recycling_type_id" UUID,
  "recycling_employee_id" UUID, "recycling_employee_name" VARCHAR(100),
  "recycling_notes" VARCHAR(250), "recycled_at" TIMESTAMPTZ(6) NOT NULL,
  "audience" VARCHAR(100), "warranty_card" VARCHAR(20) NOT NULL, "warranty_card_year" INTEGER,
  "unique_code" VARCHAR(100), "tags" JSONB NOT NULL DEFAULT '[]',
  "accessories" JSONB NOT NULL DEFAULT '[]', "internal_notes" VARCHAR(250),
  "stocked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_intakes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_intakes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "platform"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "product_intakes_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "commerce"."products"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "product_intakes_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "commerce"."brand_series"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "product_intakes_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "commerce"."brand_models"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "product_intakes_appraiser_employee_id_fkey" FOREIGN KEY ("appraiser_employee_id") REFERENCES "platform"."admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "product_intakes_recycling_employee_id_fkey" FOREIGN KEY ("recycling_employee_id") REFERENCES "platform"."admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "product_intakes_recycling_type_id_fkey" FOREIGN KEY ("recycling_type_id") REFERENCES "commerce"."recycling_types"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "product_intakes_product_id_key" ON "commerce"."product_intakes"("product_id");
CREATE UNIQUE INDEX "product_intakes_tenant_id_idempotency_key_key" ON "commerce"."product_intakes"("tenant_id", "idempotency_key");
CREATE INDEX "product_intakes_tenant_id_stocked_at_idx" ON "commerce"."product_intakes"("tenant_id", "stocked_at");

CREATE TABLE "commerce"."product_intake_media" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "tenant_id" UUID NOT NULL,
  "intake_id" UUID NOT NULL, "media_asset_id" UUID NOT NULL,
  "group" VARCHAR(30) NOT NULL, "visibility" VARCHAR(20) NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0, "duration_seconds" INTEGER,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_intake_media_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_intake_media_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "platform"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "product_intake_media_intake_id_fkey" FOREIGN KEY ("intake_id") REFERENCES "commerce"."product_intakes"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "product_intake_media_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "shared"."media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "product_intake_media_media_asset_id_key" ON "commerce"."product_intake_media"("media_asset_id");
CREATE INDEX "product_intake_media_tenant_id_intake_id_group_sort_order_idx" ON "commerce"."product_intake_media"("tenant_id", "intake_id", "group", "sort_order");

INSERT INTO "commerce"."categories" ("tenant_id", "name", "sort_order")
SELECT t."id", seed."name", seed."sort_order" FROM "platform"."tenants" t
CROSS JOIN (VALUES ('箱包', 0), ('珠宝', 1), ('服饰', 2), ('其他', 3), ('配饰', 4)) seed("name", "sort_order")
ON CONFLICT ("tenant_id", "name") DO NOTHING;
INSERT INTO "commerce"."recycling_types" ("tenant_id", "name", "sort_order")
SELECT t."id", seed."name", seed."sort_order" FROM "platform"."tenants" t
CROSS JOIN (VALUES ('其他', 0), ('线上', 1), ('同行', 2), ('门店', 3)) seed("name", "sort_order")
ON CONFLICT ("tenant_id", "name") DO NOTHING;

ALTER TABLE "commerce"."brand_series" ENABLE ROW LEVEL SECURITY; ALTER TABLE "commerce"."brand_series" FORCE ROW LEVEL SECURITY;
ALTER TABLE "commerce"."brand_models" ENABLE ROW LEVEL SECURITY; ALTER TABLE "commerce"."brand_models" FORCE ROW LEVEL SECURITY;
ALTER TABLE "commerce"."recycling_types" ENABLE ROW LEVEL SECURITY; ALTER TABLE "commerce"."recycling_types" FORCE ROW LEVEL SECURITY;
ALTER TABLE "commerce"."product_intakes" ENABLE ROW LEVEL SECURITY; ALTER TABLE "commerce"."product_intakes" FORCE ROW LEVEL SECURITY;
ALTER TABLE "commerce"."product_intake_media" ENABLE ROW LEVEL SECURITY; ALTER TABLE "commerce"."product_intake_media" FORCE ROW LEVEL SECURITY;
CREATE POLICY "brand_series_tenant_isolation" ON "commerce"."brand_series" FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY "brand_models_tenant_isolation" ON "commerce"."brand_models" FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY "recycling_types_tenant_isolation" ON "commerce"."recycling_types" FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY "product_intakes_tenant_isolation" ON "commerce"."product_intakes" FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY "product_intake_media_tenant_isolation" ON "commerce"."product_intake_media" FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
