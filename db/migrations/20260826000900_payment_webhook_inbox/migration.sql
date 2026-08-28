CREATE TABLE "commerce"."payment_webhook_events" (
  "id" BIGSERIAL NOT NULL,
  "tenant_id" UUID NOT NULL,
  "channel" VARCHAR(30) NOT NULL,
  "event_id" VARCHAR(100) NOT NULL,
  "payload_fingerprint" VARCHAR(64) NOT NULL,
  "payload" JSONB NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_error" VARCHAR(1000),
  "processed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "payment_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_webhook_events_tenant_id_channel_event_id_key"
  ON "commerce"."payment_webhook_events"("tenant_id", "channel", "event_id");
CREATE INDEX "payment_webhook_events_tenant_id_status_next_attempt_at_idx"
  ON "commerce"."payment_webhook_events"("tenant_id", "status", "next_attempt_at");

ALTER TABLE "commerce"."payment_webhook_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "commerce"."payment_webhook_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY "payment_webhook_events_tenant_isolation" ON "commerce"."payment_webhook_events"
  USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
