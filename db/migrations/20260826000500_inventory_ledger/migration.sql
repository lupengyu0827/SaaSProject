CREATE TABLE "commerce"."inventory_transactions" (
  "id" BIGSERIAL PRIMARY KEY,
  "tenant_id" UUID NOT NULL,
  "variant_id" UUID NOT NULL,
  "type" VARCHAR(20) NOT NULL,
  "qty_change" INTEGER NOT NULL,
  "reference_type" VARCHAR(30) NOT NULL,
  "reference_id" VARCHAR(100) NOT NULL,
  "reason" VARCHAR(200),
  "operator_id" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY ("variant_id") REFERENCES "commerce"."product_variants"("id")
);
CREATE UNIQUE INDEX "inventory_transactions_idempotency_key"
  ON "commerce"."inventory_transactions"("tenant_id", "variant_id", "type", "reference_type", "reference_id");
CREATE INDEX "inventory_transactions_tenant_variant_time_idx"
  ON "commerce"."inventory_transactions"("tenant_id", "variant_id", "created_at");
ALTER TABLE "commerce"."inventory_transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "commerce"."inventory_transactions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "inventory_transaction_tenant_isolation" ON "commerce"."inventory_transactions" FOR ALL
  USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID);
