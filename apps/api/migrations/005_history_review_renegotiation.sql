ALTER TABLE memberships ADD COLUMN IF NOT EXISTS last_reviewed_at timestamptz;

CREATE TABLE IF NOT EXISTS weekly_reviews (
  id text PRIMARY KEY,
  household_id text NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  felt_heavy text CHECK (felt_heavy IN ('nao', 'pouco', 'bastante')),
  felt_noticed text CHECK (felt_noticed IN ('sim', 'nao_muito', 'nao')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS weekly_reviews_user_household_idx ON weekly_reviews(user_id, household_id, reviewed_at DESC);

ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS review_reminder_enabled boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS review_reminder_deliveries (
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  household_id text NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  timezone text NOT NULL,
  local_date date NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,household_id,timezone,local_date)
);
