CREATE TABLE "commerce"."orders" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "order_no" VARCHAR(40) NOT NULL,
  "idempotency_key" VARCHAR(100) NOT NULL,
  "request_fingerprint" VARCHAR(64) NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
  "customer" JSONB NOT NULL DEFAULT '{}',
  "shipping_address" JSONB NOT NULL,
  "subtotal" DECIMAL(12,2) NOT NULL,
  "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "shipping_fee" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "total" DECIMAL(12,2) NOT NULL,
  "remark" VARCHAR(500),
  "canceled_at" TIMESTAMPTZ(6),
  "canceled_by" UUID,
  "cancel_reason" VARCHAR(200),
  "created_by" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "commerce"."order_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "order_id" UUID NOT NULL,
  "variant_id" UUID NOT NULL,
  "product_name" VARCHAR(200) NOT NULL,
  "sku" VARCHAR(80) NOT NULL,
  "specs" JSONB NOT NULL DEFAULT '{}',
  "unit_price" DECIMAL(12,2) NOT NULL,
  "quantity" INTEGER NOT NULL,
  "line_total" DECIMAL(12,2) NOT NULL,
  CONSTRAINT "order_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "commerce"."orders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "order_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "commerce"."product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "orders_tenant_id_order_no_key" ON "commerce"."orders"("tenant_id", "order_no");
CREATE UNIQUE INDEX "orders_tenant_id_idempotency_key_key" ON "commerce"."orders"("tenant_id", "idempotency_key");
CREATE INDEX "orders_tenant_id_status_created_at_idx" ON "commerce"."orders"("tenant_id", "status", "created_at");
CREATE UNIQUE INDEX "order_items_tenant_id_order_id_variant_id_key" ON "commerce"."order_items"("tenant_id", "order_id", "variant_id");
CREATE INDEX "order_items_tenant_id_order_id_idx" ON "commerce"."order_items"("tenant_id", "order_id");

ALTER TABLE "commerce"."orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "commerce"."orders" FORCE ROW LEVEL SECURITY;
CREATE POLICY "orders_tenant_isolation" ON "commerce"."orders"
  USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

ALTER TABLE "commerce"."order_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "commerce"."order_items" FORCE ROW LEVEL SECURITY;
CREATE POLICY "order_items_tenant_isolation" ON "commerce"."order_items"
  USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
