CREATE TABLE "commerce"."payment_reconciliation_runs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "channel" VARCHAR(30) NOT NULL,
  "bill_date" DATE NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'processing',
  "local_count" INTEGER NOT NULL DEFAULT 0,
  "provider_count" INTEGER NOT NULL DEFAULT 0,
  "discrepancy_count" INTEGER NOT NULL DEFAULT 0,
  "error_message" VARCHAR(1000),
  "completed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "payment_reconciliation_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "commerce"."payment_reconciliation_discrepancies" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "run_id" UUID NOT NULL,
  "payment_no" VARCHAR(40) NOT NULL,
  "type" VARCHAR(40) NOT NULL,
  "local_amount" DECIMAL(12,2),
  "provider_amount" DECIMAL(12,2),
  "provider_trade_no" VARCHAR(100),
  "resolved_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_reconciliation_discrepancies_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_reconciliation_discrepancies_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "commerce"."payment_reconciliation_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "payment_reconciliation_runs_tenant_channel_date_key" ON "commerce"."payment_reconciliation_runs"("tenant_id", "channel", "bill_date");
CREATE INDEX "payment_reconciliation_runs_tenant_status_date_idx" ON "commerce"."payment_reconciliation_runs"("tenant_id", "status", "bill_date");
CREATE UNIQUE INDEX "payment_reconciliation_discrepancies_unique" ON "commerce"."payment_reconciliation_discrepancies"("tenant_id", "run_id", "payment_no", "type");
CREATE INDEX "payment_reconciliation_discrepancies_tenant_type_resolved_idx" ON "commerce"."payment_reconciliation_discrepancies"("tenant_id", "type", "resolved_at");

ALTER TABLE "commerce"."payment_reconciliation_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "commerce"."payment_reconciliation_runs" FORCE ROW LEVEL SECURITY;
CREATE POLICY "payment_reconciliation_runs_tenant_isolation" ON "commerce"."payment_reconciliation_runs"
  USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

ALTER TABLE "commerce"."payment_reconciliation_discrepancies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "commerce"."payment_reconciliation_discrepancies" FORCE ROW LEVEL SECURITY;
CREATE POLICY "payment_reconciliation_discrepancies_tenant_isolation" ON "commerce"."payment_reconciliation_discrepancies"
  USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
