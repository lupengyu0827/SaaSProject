ALTER TABLE "commerce"."products"
  ADD COLUMN "deleted_at" TIMESTAMPTZ(6);

ALTER TABLE "commerce"."product_variants"
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "deleted_at" TIMESTAMPTZ(6);

CREATE TABLE "commerce"."product_images" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "url" VARCHAR(1000) NOT NULL,
  "alt_text" VARCHAR(200),
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_primary" BOOLEAN NOT NULL DEFAULT false,
  "size_bytes" INTEGER NOT NULL,
  "mime_type" VARCHAR(50) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 0,
  "deleted_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_images_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id")
    REFERENCES "commerce"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

DROP INDEX IF EXISTS "commerce"."products_tenant_id_status_created_at_idx";
DROP INDEX IF EXISTS "commerce"."product_variants_tenant_id_product_id_idx";
CREATE INDEX "products_tenant_id_status_deleted_at_created_at_idx"
  ON "commerce"."products"("tenant_id", "status", "deleted_at", "created_at");
CREATE INDEX "product_variants_tenant_id_product_id_deleted_at_idx"
  ON "commerce"."product_variants"("tenant_id", "product_id", "deleted_at");
CREATE INDEX "product_images_tenant_id_product_id_deleted_at_sort_order_idx"
  ON "commerce"."product_images"("tenant_id", "product_id", "deleted_at", "sort_order");

ALTER TABLE "commerce"."product_images" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "commerce"."product_images" FORCE ROW LEVEL SECURITY;
CREATE POLICY "product_images_tenant_isolation" ON "commerce"."product_images"
  USING ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid);

CREATE TABLE "shared"."domain_event_outbox" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "aggregate_type" VARCHAR(50) NOT NULL,
  "aggregate_id" VARCHAR(100) NOT NULL,
  "event_type" VARCHAR(100) NOT NULL,
  "payload" JSONB NOT NULL,
  "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "published_at" TIMESTAMPTZ(6),
  CONSTRAINT "domain_event_outbox_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "domain_event_outbox_tenant_id_published_at_occurred_at_idx"
  ON "shared"."domain_event_outbox"("tenant_id", "published_at", "occurred_at");
