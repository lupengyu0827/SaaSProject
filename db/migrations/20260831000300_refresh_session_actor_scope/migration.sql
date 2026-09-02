-- Refresh Token 必须绑定签发终端，禁止 PC 与商家小程序互换会话。
ALTER TABLE platform.refresh_sessions
  ADD COLUMN actor_type VARCHAR(30) NOT NULL DEFAULT 'admin_user';

DROP INDEX IF EXISTS platform.refresh_sessions_user_id_expires_at_idx;

CREATE INDEX refresh_sessions_user_id_actor_type_expires_at_idx
  ON platform.refresh_sessions (user_id, actor_type, expires_at);
