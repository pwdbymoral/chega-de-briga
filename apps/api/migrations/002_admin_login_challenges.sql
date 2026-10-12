CREATE TABLE IF NOT EXISTS admin_login_challenges (
  token_hash text PRIMARY KEY,
  admin_id text NOT NULL REFERENCES platform_admins(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_login_challenges_expiry_idx ON admin_login_challenges(expires_at);
