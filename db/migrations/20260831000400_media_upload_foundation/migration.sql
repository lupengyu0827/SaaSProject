CREATE TABLE shared.media_upload_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL,
  purpose VARCHAR(30) NOT NULL,
  object_key VARCHAR(300) NOT NULL UNIQUE,
  file_name VARCHAR(200) NOT NULL,
  mime_type VARCHAR(50) NOT NULL,
  size_bytes INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'initiated',
  expires_at TIMESTAMPTZ(6) NOT NULL,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

CREATE INDEX media_upload_sessions_tenant_status_expires_idx
  ON shared.media_upload_sessions (tenant_id, status, expires_at);

CREATE TABLE shared.media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
  upload_session_id UUID NOT NULL UNIQUE REFERENCES shared.media_upload_sessions(id) ON DELETE RESTRICT,
  created_by UUID NOT NULL,
  purpose VARCHAR(30) NOT NULL,
  object_key VARCHAR(300) NOT NULL UNIQUE,
  mime_type VARCHAR(50) NOT NULL,
  size_bytes INTEGER NOT NULL,
  sha256 VARCHAR(64) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'temporary',
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ(6)
);

CREATE INDEX media_assets_tenant_status_created_idx
  ON shared.media_assets (tenant_id, status, created_at);
