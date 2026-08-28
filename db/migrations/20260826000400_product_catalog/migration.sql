CREATE TABLE "commerce"."categories" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "tenant_id" UUID NOT NULL,
  "parent_id" UUID, "name" VARCHAR(100) NOT NULL, "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY ("parent_id") REFERENCES "commerce"."categories"("id"), UNIQUE ("tenant_id", "name")
);
CREATE INDEX "categories_tenant_id_parent_id_idx" ON "commerce"."categories"("tenant_id", "parent_id");
CREATE TABLE "commerce"."brands" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "tenant_id" UUID NOT NULL,
  "name" VARCHAR(100) NOT NULL, "logo_url" VARCHAR(500), "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("tenant_id", "name")
);
CREATE TABLE "commerce"."products" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "tenant_id" UUID NOT NULL,
  "category_id" UUID, "brand_id" UUID, "code" VARCHAR(50) NOT NULL, "name" VARCHAR(200) NOT NULL,
  "description" TEXT, "attributes" JSONB NOT NULL DEFAULT '{}', "seo_slug" VARCHAR(200),
  "status" VARCHAR(20) NOT NULL DEFAULT 'draft', "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "created_by" UUID, "updated_by" UUID, "version" INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY ("category_id") REFERENCES "commerce"."categories"("id"),
  FOREIGN KEY ("brand_id") REFERENCES "commerce"."brands"("id"),
  UNIQUE ("tenant_id", "code"), UNIQUE ("tenant_id", "seo_slug")
);
CREATE INDEX "products_tenant_id_status_created_at_idx" ON "commerce"."products"("tenant_id", "status", "created_at");
CREATE TABLE "commerce"."product_variants" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "tenant_id" UUID NOT NULL, "product_id" UUID NOT NULL,
  "sku" VARCHAR(80) NOT NULL, "specs" JSONB NOT NULL DEFAULT '{}', "price" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "cost_price" DECIMAL(12,2) NOT NULL DEFAULT 0, "weight_g" DECIMAL(10,2),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY ("product_id") REFERENCES "commerce"."products"("id") ON DELETE CASCADE,
  UNIQUE ("tenant_id", "sku")
);
CREATE INDEX "product_variants_tenant_id_product_id_idx" ON "commerce"."product_variants"("tenant_id", "product_id");

ALTER TABLE "commerce"."categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "commerce"."brands" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "commerce"."products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "commerce"."product_variants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "commerce"."categories" FORCE ROW LEVEL SECURITY;
ALTER TABLE "commerce"."brands" FORCE ROW LEVEL SECURITY;
ALTER TABLE "commerce"."products" FORCE ROW LEVEL SECURITY;
ALTER TABLE "commerce"."product_variants" FORCE ROW LEVEL SECURITY;
CREATE POLICY "category_tenant_isolation" ON "commerce"."categories" FOR ALL
  USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID);
CREATE POLICY "brand_tenant_isolation" ON "commerce"."brands" FOR ALL
  USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID);
CREATE POLICY "product_tenant_isolation" ON "commerce"."products" FOR ALL
  USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID);
CREATE POLICY "variant_tenant_isolation" ON "commerce"."product_variants" FOR ALL
  USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID);
