CREATE TABLE "commerce"."refunds" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "order_id" UUID NOT NULL,
  "refund_no" VARCHAR(40) NOT NULL,
  "idempotency_key" VARCHAR(100) NOT NULL,
  "request_fingerprint" VARCHAR(64) NOT NULL,
  "status" VARCHAR(30) NOT NULL DEFAULT 'pending_review',
  "reason" VARCHAR(500) NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "review_note" VARCHAR(500),
  "reviewed_by" UUID,
  "reviewed_at" TIMESTAMPTZ(6),
  "created_by" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "refunds_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "refunds_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "commerce"."orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "refunds_amount_check" CHECK ("amount" > 0)
);

CREATE TABLE "commerce"."refund_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "refund_id" UUID NOT NULL,
  "order_item_id" UUID NOT NULL,
  "quantity" INTEGER NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  CONSTRAINT "refund_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "refund_items_refund_id_fkey" FOREIGN KEY ("refund_id") REFERENCES "commerce"."refunds"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "refund_items_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "commerce"."order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "refund_items_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "refund_items_amount_check" CHECK ("amount" > 0)
);

CREATE TABLE "commerce"."refund_transactions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "refund_id" UUID NOT NULL,
  "channel" VARCHAR(30) NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
  "amount" DECIMAL(12,2) NOT NULL,
  "provider_refund_no" VARCHAR(100),
  "event_id" VARCHAR(100),
  "failure_reason" VARCHAR(500),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "refund_transactions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "refund_transactions_refund_id_fkey" FOREIGN KEY ("refund_id") REFERENCES "commerce"."refunds"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "refund_transactions_amount_check" CHECK ("amount" > 0)
);

CREATE UNIQUE INDEX "refunds_tenant_id_refund_no_key" ON "commerce"."refunds"("tenant_id", "refund_no");
CREATE UNIQUE INDEX "refunds_tenant_id_idempotency_key_key" ON "commerce"."refunds"("tenant_id", "idempotency_key");
CREATE INDEX "refunds_tenant_id_order_id_created_at_idx" ON "commerce"."refunds"("tenant_id", "order_id", "created_at");
CREATE INDEX "refunds_tenant_id_status_created_at_idx" ON "commerce"."refunds"("tenant_id", "status", "created_at");
CREATE UNIQUE INDEX "refund_items_tenant_id_refund_id_order_item_id_key" ON "commerce"."refund_items"("tenant_id", "refund_id", "order_item_id");
CREATE INDEX "refund_items_tenant_id_order_item_id_idx" ON "commerce"."refund_items"("tenant_id", "order_item_id");
CREATE UNIQUE INDEX "refund_transactions_tenant_id_channel_event_id_key" ON "commerce"."refund_transactions"("tenant_id", "channel", "event_id");
CREATE INDEX "refund_transactions_tenant_id_refund_id_created_at_idx" ON "commerce"."refund_transactions"("tenant_id", "refund_id", "created_at");

ALTER TABLE "commerce"."refunds" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "commerce"."refunds" FORCE ROW LEVEL SECURITY;
CREATE POLICY "refunds_tenant_isolation" ON "commerce"."refunds"
  USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

ALTER TABLE "commerce"."refund_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "commerce"."refund_items" FORCE ROW LEVEL SECURITY;
CREATE POLICY "refund_items_tenant_isolation" ON "commerce"."refund_items"
  USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

ALTER TABLE "commerce"."refund_transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "commerce"."refund_transactions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "refund_transactions_tenant_isolation" ON "commerce"."refund_transactions"
  USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
