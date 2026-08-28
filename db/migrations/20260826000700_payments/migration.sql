CREATE TABLE "commerce"."payments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "order_id" UUID NOT NULL,
  "payment_no" VARCHAR(40) NOT NULL,
  "idempotency_key" VARCHAR(100) NOT NULL,
  "channel" VARCHAR(30) NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
  "amount" DECIMAL(12,2) NOT NULL,
  "provider_trade_no" VARCHAR(100),
  "callback_event_id" VARCHAR(100),
  "failure_reason" VARCHAR(200),
  "paid_at" TIMESTAMPTZ(6),
  "created_by" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "payments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "commerce"."orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "payments_tenant_id_payment_no_key" ON "commerce"."payments"("tenant_id", "payment_no");
CREATE UNIQUE INDEX "payments_tenant_id_idempotency_key_key" ON "commerce"."payments"("tenant_id", "idempotency_key");
CREATE UNIQUE INDEX "payments_channel_callback_event_id_key" ON "commerce"."payments"("channel", "callback_event_id");
CREATE INDEX "payments_tenant_id_order_id_created_at_idx" ON "commerce"."payments"("tenant_id", "order_id", "created_at");

ALTER TABLE "commerce"."payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "commerce"."payments" FORCE ROW LEVEL SECURITY;
CREATE POLICY "payments_tenant_isolation" ON "commerce"."payments"
  USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
