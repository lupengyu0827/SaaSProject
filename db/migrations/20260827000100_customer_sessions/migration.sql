CREATE TABLE "platform"."customers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "wechat_open_id" VARCHAR(64) NOT NULL,
    "wechat_union_id" VARCHAR(64),
    "display_name" VARCHAR(100),
    "avatar_url" VARCHAR(500),
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "platform"."customer_refresh_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "customer_refresh_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "customers_tenant_id_wechat_open_id_key" ON "platform"."customers"("tenant_id", "wechat_open_id");
CREATE INDEX "customers_tenant_id_status_idx" ON "platform"."customers"("tenant_id", "status");
CREATE UNIQUE INDEX "customer_refresh_sessions_token_hash_key" ON "platform"."customer_refresh_sessions"("token_hash");
CREATE INDEX "customer_refresh_sessions_customer_id_expires_at_idx" ON "platform"."customer_refresh_sessions"("customer_id", "expires_at");

ALTER TABLE "platform"."customers" ADD CONSTRAINT "customers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "platform"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "platform"."customer_refresh_sessions" ADD CONSTRAINT "customer_refresh_sessions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "platform"."customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
