CREATE TABLE "platform"."provider_callback_routes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "channel" VARCHAR(30) NOT NULL,
  "resource_type" VARCHAR(30) NOT NULL,
  "external_no" VARCHAR(100) NOT NULL,
  "resource_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "provider_callback_routes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "provider_callback_routes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "platform"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "provider_callback_routes_channel_resource_type_external_no_key"
  ON "platform"."provider_callback_routes"("channel", "resource_type", "external_no");
CREATE INDEX "provider_callback_routes_tenant_id_resource_type_resource_id_idx"
  ON "platform"."provider_callback_routes"("tenant_id", "resource_type", "resource_id");

CREATE TABLE "commerce"."refund_webhook_events" (
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
  CONSTRAINT "refund_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "refund_webhook_events_tenant_id_channel_event_id_key"
  ON "commerce"."refund_webhook_events"("tenant_id", "channel", "event_id");
CREATE INDEX "refund_webhook_events_tenant_id_status_next_attempt_at_idx"
  ON "commerce"."refund_webhook_events"("tenant_id", "status", "next_attempt_at");

ALTER TABLE "commerce"."refund_webhook_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "commerce"."refund_webhook_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY "refund_webhook_events_tenant_isolation" ON "commerce"."refund_webhook_events"
  USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
