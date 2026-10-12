ALTER TABLE access_grants DROP CONSTRAINT IF EXISTS access_grants_source_check;
ALTER TABLE access_grants ADD CONSTRAINT access_grants_source_check
  CHECK (source IN ('lista', 'convite_admin', 'convite_morador', 'publico'));
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_source_check;
ALTER TABLE users ADD CONSTRAINT users_source_check
  CHECK (source IN ('lista', 'convite_admin', 'convite_morador', 'publico'));

ALTER TABLE households
  ADD COLUMN IF NOT EXISTS first_value_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_value_type text CHECK (first_value_type IN ('tarefa', 'compra'));
ALTER TABLE households
  ADD COLUMN IF NOT EXISTS created_by_user_id text REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS waitlist_contacts (
  id text PRIMARY KEY,
  channel text NOT NULL CHECK (channel IN ('email', 'whatsapp')),
  contact text NOT NULL,
  consent_at timestamptz NOT NULL,
  consent_version text NOT NULL,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(channel, contact)
);
CREATE INDEX IF NOT EXISTS waitlist_contacts_created_idx ON waitlist_contacts(created_at DESC, id);
CREATE INDEX IF NOT EXISTS waitlist_contacts_channel_idx ON waitlist_contacts(channel, created_at DESC);
CREATE INDEX IF NOT EXISTS waitlist_contacts_campaign_idx ON waitlist_contacts(utm_campaign, created_at DESC);

CREATE TABLE IF NOT EXISTS public_landing_events (
  id text PRIMARY KEY,
  event_type text NOT NULL CHECK (event_type IN ('landing_view', 'form_start', 'waitlist_signup')),
  channel text CHECK (channel IN ('email', 'whatsapp')),
  utm_source text,
  utm_medium text,
  utm_campaign text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS public_landing_events_time_idx ON public_landing_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS public_landing_events_campaign_idx ON public_landing_events(utm_campaign, occurred_at DESC);
