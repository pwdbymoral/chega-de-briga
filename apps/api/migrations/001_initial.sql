CREATE TABLE IF NOT EXISTS accounts (
  id text PRIMARY KEY,
  email text NOT NULL,
  password_hash text NOT NULL,
  email_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS accounts_email_idx ON accounts(lower(email));

CREATE TABLE IF NOT EXISTS platform_admins (
  id text PRIMARY KEY,
  account_id text NOT NULL UNIQUE REFERENCES accounts(id),
  totp_secret text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz
);

CREATE TABLE IF NOT EXISTS admin_bootstrap_tokens (
  id text PRIMARY KEY,
  email text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  totp_secret text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash text PRIMARY KEY,
  admin_id text NOT NULL REFERENCES platform_admins(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_recovery_codes (
  id text PRIMARY KEY,
  admin_id text NOT NULL REFERENCES platform_admins(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  used_at timestamptz
);

CREATE TABLE IF NOT EXISTS access_grants (
  id text PRIMARY KEY,
  email text NOT NULL,
  source text NOT NULL CHECK (source IN ('lista', 'convite_admin', 'convite_morador')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  account_id text NOT NULL UNIQUE REFERENCES accounts(id),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'suspenso', 'excluido')),
  source text NOT NULL CHECK (source IN ('lista', 'convite_admin', 'convite_morador')),
  access_id text NOT NULL REFERENCES access_grants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz
);

CREATE TABLE IF NOT EXISTS user_sessions (
  token_hash text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS allow_entries (
  id text PRIMARY KEY,
  access_id text NOT NULL UNIQUE REFERENCES access_grants(id),
  created_by text NOT NULL REFERENCES platform_admins(id),
  revoked_at timestamptz
);

CREATE TABLE IF NOT EXISTS households (
  id text PRIMARY KEY,
  name text NOT NULL,
  timezone text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS memberships (
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  household_id text NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('responsavel', 'morador')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, household_id)
);

CREATE TABLE IF NOT EXISTS invitations (
  id text PRIMARY KEY,
  access_id text NOT NULL UNIQUE REFERENCES access_grants(id),
  token_hash text NOT NULL UNIQUE,
  household_id text REFERENCES households(id) ON DELETE CASCADE,
  inviter_user_id text REFERENCES users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aceito', 'revogado', 'expirado')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  revoked_at timestamptz
);

CREATE TABLE IF NOT EXISTS email_tokens (
  token_hash text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('verification', 'password_reset')),
  expires_at timestamptz NOT NULL,
  used_at timestamptz
);

CREATE TABLE IF NOT EXISTS household_state (
  household_id text PRIMARY KEY REFERENCES households(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  data jsonb NOT NULL DEFAULT '{"members":[],"tasks":[],"items":[],"invites":[]}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS task_metadata (
  id text PRIMARY KEY,
  household_id text NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL,
  due_at timestamptz,
  completed_at timestamptz,
  is_open boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS task_versions (
  id text PRIMARY KEY,
  event_id text NOT NULL UNIQUE,
  household_id text NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  task_id text NOT NULL,
  effective_from date,
  scope text NOT NULL CHECK (scope IN ('occurrence','series')),
  snapshot jsonb NOT NULL,
  changed_by text REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS task_occurrences (
  id text PRIMARY KEY,
  event_id text NOT NULL UNIQUE,
  household_id text NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  task_id text NOT NULL,
  occurrence_key text NOT NULL,
  scheduled_for date,
  outcome text NOT NULL CHECK (outcome IN ('concluida','pulada')),
  assigned_user_id text REFERENCES users(id) ON DELETE SET NULL,
  completed_by_user_id text REFERENCES users(id) ON DELETE SET NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(household_id,task_id,occurrence_key)
);

CREATE TABLE IF NOT EXISTS activity_events (
  id text PRIMARY KEY,
  event_type text NOT NULL,
  user_id text REFERENCES users(id) ON DELETE SET NULL,
  household_id text REFERENCES households(id) ON DELETE SET NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_audit_events (
  id text PRIMARY KEY,
  actor_admin_id text REFERENCES platform_admins(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  request_id text NOT NULL
);

CREATE TABLE IF NOT EXISTS mail_outbox (
  id text PRIMARY KEY,
  recipient text NOT NULL,
  subject text NOT NULL,
  body_encrypted text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  reminder_enabled boolean NOT NULL DEFAULT false,
  reminder_time time NOT NULL DEFAULT '08:00'
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint_hash text NOT NULL UNIQUE,
  subscription_encrypted text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  invalid_at timestamptz
);

CREATE TABLE IF NOT EXISTS reminder_deliveries (
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  timezone text NOT NULL,
  local_date date NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,timezone,local_date)
);

CREATE INDEX IF NOT EXISTS user_sessions_expiry_idx ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS users_account_idx ON users(account_id);
CREATE INDEX IF NOT EXISTS admin_sessions_expiry_idx ON admin_sessions(expires_at);
CREATE INDEX IF NOT EXISTS activity_events_time_idx ON activity_events(occurred_at);
CREATE INDEX IF NOT EXISTS task_metadata_household_idx ON task_metadata(household_id);
CREATE INDEX IF NOT EXISTS task_versions_history_idx ON task_versions(household_id,task_id,created_at);
CREATE INDEX IF NOT EXISTS task_occurrences_history_idx ON task_occurrences(household_id,occurred_at DESC);
CREATE INDEX IF NOT EXISTS mail_outbox_due_idx ON mail_outbox(next_attempt_at);
