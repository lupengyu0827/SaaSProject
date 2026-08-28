CREATE TABLE "commerce"."shipments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "order_id" UUID NOT NULL,
  "shipment_no" VARCHAR(40) NOT NULL,
  "carrier_code" VARCHAR(40) NOT NULL,
  "carrier_name" VARCHAR(80) NOT NULL,
  "tracking_no" VARCHAR(100) NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'shipped',
  "shipped_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "delivered_at" TIMESTAMPTZ(6),
  "created_by" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "shipments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "shipments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "commerce"."orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "commerce"."shipment_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "shipment_id" UUID NOT NULL,
  "order_item_id" UUID NOT NULL,
  "quantity" INTEGER NOT NULL,
  CONSTRAINT "shipment_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "shipment_items_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "commerce"."shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "shipment_items_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "commerce"."order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "shipment_items_quantity_check" CHECK ("quantity" > 0)
);

CREATE UNIQUE INDEX "shipments_tenant_id_shipment_no_key" ON "commerce"."shipments"("tenant_id", "shipment_no");
CREATE UNIQUE INDEX "shipments_tenant_id_carrier_code_tracking_no_key" ON "commerce"."shipments"("tenant_id", "carrier_code", "tracking_no");
CREATE INDEX "shipments_tenant_id_order_id_created_at_idx" ON "commerce"."shipments"("tenant_id", "order_id", "created_at");
CREATE UNIQUE INDEX "shipment_items_tenant_id_shipment_id_order_item_id_key" ON "commerce"."shipment_items"("tenant_id", "shipment_id", "order_item_id");
CREATE INDEX "shipment_items_tenant_id_order_item_id_idx" ON "commerce"."shipment_items"("tenant_id", "order_item_id");

ALTER TABLE "commerce"."shipments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "commerce"."shipments" FORCE ROW LEVEL SECURITY;
CREATE POLICY "shipments_tenant_isolation" ON "commerce"."shipments"
  USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

ALTER TABLE "commerce"."shipment_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "commerce"."shipment_items" FORCE ROW LEVEL SECURITY;
CREATE POLICY "shipment_items_tenant_isolation" ON "commerce"."shipment_items"
  USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
