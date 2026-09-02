ALTER TABLE shared.media_assets
  ADD COLUMN purged_at TIMESTAMPTZ(6);

CREATE INDEX media_assets_status_deleted_purged_idx
  ON shared.media_assets (status, deleted_at, purged_at);
