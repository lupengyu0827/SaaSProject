ALTER TABLE "commerce"."categories"
  ADD COLUMN "status" VARCHAR(20) NOT NULL DEFAULT 'active',
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "deleted_at" TIMESTAMPTZ(6),
  ADD COLUMN "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "commerce"."brands"
  ADD COLUMN "status" VARCHAR(20) NOT NULL DEFAULT 'active',
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "deleted_at" TIMESTAMPTZ(6),
  ADD COLUMN "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "categories_tenant_id_status_deleted_at_idx"
  ON "commerce"."categories"("tenant_id", "status", "deleted_at");

CREATE INDEX "brands_tenant_id_status_deleted_at_idx"
  ON "commerce"."brands"("tenant_id", "status", "deleted_at");
