ALTER TABLE "platform"."admin_users" ADD COLUMN "password_hash" TEXT;
UPDATE "platform"."admin_users" SET "password_hash" = 'disabled' WHERE "password_hash" IS NULL;
ALTER TABLE "platform"."admin_users" ALTER COLUMN "password_hash" SET NOT NULL;

CREATE TABLE "platform"."refresh_sessions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "token_hash" VARCHAR(64) UNIQUE NOT NULL,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "revoked_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY ("user_id") REFERENCES "platform"."admin_users"("id") ON DELETE CASCADE
);
CREATE INDEX "refresh_sessions_user_id_expires_at_idx"
  ON "platform"."refresh_sessions"("user_id", "expires_at");
