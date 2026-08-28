ALTER TABLE "commerce"."orders"
  ADD COLUMN "expires_at" TIMESTAMPTZ(6),
  ADD COLUMN "expired_at" TIMESTAMPTZ(6);

UPDATE "commerce"."orders"
SET "expires_at" = "created_at" + INTERVAL '30 minutes'
WHERE "expires_at" IS NULL;

ALTER TABLE "commerce"."orders" ALTER COLUMN "expires_at" SET NOT NULL;

DROP INDEX "commerce"."orders_tenant_id_status_created_at_idx";
CREATE INDEX "orders_tenant_id_status_expires_at_idx"
  ON "commerce"."orders"("tenant_id", "status", "expires_at");
