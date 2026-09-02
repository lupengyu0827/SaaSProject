ALTER TABLE "shared"."media_upload_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "shared"."media_upload_sessions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "media_upload_sessions_tenant_isolation"
  ON "shared"."media_upload_sessions"
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE "shared"."media_assets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "shared"."media_assets" FORCE ROW LEVEL SECURITY;
CREATE POLICY "media_assets_tenant_isolation"
  ON "shared"."media_assets"
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
