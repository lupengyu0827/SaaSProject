CREATE SCHEMA IF NOT EXISTS "shared";
CREATE SCHEMA IF NOT EXISTS "commerce";

CREATE TABLE "platform"."admin_users" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "tenant_id" UUID NOT NULL,
  "email" VARCHAR(200) NOT NULL, "display_name" VARCHAR(100) NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'active', "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE ("tenant_id", "email"),
  FOREIGN KEY ("tenant_id") REFERENCES "platform"."tenants"("id") ON DELETE CASCADE
);
CREATE TABLE "platform"."roles" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "tenant_id" UUID NOT NULL,
  "code" VARCHAR(50) NOT NULL, "name" VARCHAR(100) NOT NULL, "is_system" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE ("tenant_id", "code"),
  FOREIGN KEY ("tenant_id") REFERENCES "platform"."tenants"("id") ON DELETE CASCADE
);
CREATE TABLE "platform"."permissions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "key" VARCHAR(100) UNIQUE NOT NULL,
  "description" TEXT, "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE "platform"."role_permissions" (
  "role_id" UUID NOT NULL, "permission_id" UUID NOT NULL, PRIMARY KEY ("role_id", "permission_id"),
  FOREIGN KEY ("role_id") REFERENCES "platform"."roles"("id") ON DELETE CASCADE,
  FOREIGN KEY ("permission_id") REFERENCES "platform"."permissions"("id") ON DELETE CASCADE
);
CREATE TABLE "platform"."user_roles" (
  "user_id" UUID NOT NULL, "role_id" UUID NOT NULL, PRIMARY KEY ("user_id", "role_id"),
  FOREIGN KEY ("user_id") REFERENCES "platform"."admin_users"("id") ON DELETE CASCADE,
  FOREIGN KEY ("role_id") REFERENCES "platform"."roles"("id") ON DELETE CASCADE
);
CREATE TABLE "shared"."audit_logs" (
  "id" BIGSERIAL PRIMARY KEY, "tenant_id" UUID NOT NULL, "actor_id" UUID,
  "actor_type" VARCHAR(20), "action" VARCHAR(50) NOT NULL, "resource_type" VARCHAR(50) NOT NULL,
  "resource_id" VARCHAR(100), "diff" JSONB, "request_id" VARCHAR(64), "ip" INET,
  "user_agent" TEXT, "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX "audit_logs_tenant_id_created_at_idx" ON "shared"."audit_logs"("tenant_id", "created_at");

CREATE TABLE "commerce"."tenant_probes" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "tenant_id" UUID NOT NULL,
  "payload" JSONB NOT NULL, "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX "tenant_probes_tenant_id_idx" ON "commerce"."tenant_probes"("tenant_id");
ALTER TABLE "commerce"."tenant_probes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "commerce"."tenant_probes" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_probe_isolation" ON "commerce"."tenant_probes"
  FOR ALL USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID);
