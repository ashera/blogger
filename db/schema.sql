-- Schema for blogger — AI blog generation SaaS.
-- Apply with: psql "$DATABASE_URL" -f db/schema.sql
-- (or `npm run db:setup`, which also seeds.)
--
-- Every statement is idempotent (CREATE ... IF NOT EXISTS, ADD COLUMN
-- IF NOT EXISTS) so the file can be re-applied safely on every deploy.

-- =========================================================
-- Auth & users
-- =========================================================
CREATE TABLE IF NOT EXISTS users (
  id            BIGSERIAL    PRIMARY KEY,
  email         TEXT         UNIQUE NOT NULL,
  password_hash TEXT         NOT NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_admin          BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_partner        BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS title             TEXT,
  ADD COLUMN IF NOT EXISTS first_name        TEXT,
  ADD COLUMN IF NOT EXISTS surname           TEXT,
  ADD COLUMN IF NOT EXISTS town              TEXT,
  ADD COLUMN IF NOT EXISTS postcode          TEXT,
  ADD COLUMN IF NOT EXISTS bust_cm           NUMERIC(4,1),
  ADD COLUMN IF NOT EXISTS waist_cm          NUMERIC(4,1),
  ADD COLUMN IF NOT EXISTS hips_cm           NUMERIC(4,1),
  ADD COLUMN IF NOT EXISTS suspended_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT         PRIMARY KEY,
  user_id     BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ  NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Admin impersonation: when an admin clicks 'Log in as' on a user
-- detail page we mint a new session for the target user with this
-- column set to the original admin's id.
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS impersonator_user_id BIGINT
    REFERENCES users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions (expires_at);

-- =========================================================
-- Auth tokens
-- =========================================================
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id          BIGSERIAL    PRIMARY KEY,
  user_id     BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT         NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ  NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS password_reset_tokens_user_idx
  ON password_reset_tokens (user_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id          BIGSERIAL    PRIMARY KEY,
  user_id     BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT         NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ  NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS email_verification_tokens_user_idx
  ON email_verification_tokens (user_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS email_change_tokens (
  id          BIGSERIAL    PRIMARY KEY,
  user_id     BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  new_email   TEXT         NOT NULL,
  token_hash  TEXT         NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ  NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS email_change_tokens_user_idx
  ON email_change_tokens (user_id, expires_at DESC);

-- =========================================================
-- Blog posts
-- =========================================================
CREATE TABLE IF NOT EXISTS blog_posts (
  id           BIGSERIAL    PRIMARY KEY,
  slug         TEXT         UNIQUE NOT NULL,
  title        TEXT         NOT NULL,
  excerpt      TEXT,
  body_md      TEXT         NOT NULL DEFAULT '',
  author_id    BIGINT       REFERENCES users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS blog_posts_published_idx
  ON blog_posts (published_at DESC) WHERE published_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS blog_images (
  id          BIGSERIAL    PRIMARY KEY,
  post_id     BIGINT       NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  mime_type   TEXT         NOT NULL,
  bytes       BYTEA        NOT NULL,
  byte_size   INTEGER      NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS blog_images_post_idx ON blog_images (post_id);

ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS hero_image_id BIGINT
    REFERENCES blog_images(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS blog_tags (
  id          BIGSERIAL    PRIMARY KEY,
  slug        TEXT         UNIQUE NOT NULL,
  label       TEXT         NOT NULL,
  sort_order  INTEGER      NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS blog_post_tags (
  post_id    BIGINT NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  tag_id     BIGINT NOT NULL REFERENCES blog_tags(id)  ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);

CREATE INDEX IF NOT EXISTS blog_post_tags_tag_idx
  ON blog_post_tags (tag_id, post_id);

CREATE TABLE IF NOT EXISTS blog_post_views (
  id          BIGSERIAL    PRIMARY KEY,
  post_id     BIGINT       NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  viewed_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  viewer_id   BIGINT       REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS blog_post_views_post_time_idx
  ON blog_post_views (post_id, viewed_at DESC);

-- =========================================================
-- Blog Builder: SEED → cluster → SERP → images → instances
--
-- A "blog seed" is the top-level unit a user configures through the
-- wizard. Each seed owns ONE cluster (its keyword set), ONE SERP
-- analysis, ONE image pool, and MANY blog instances (generated posts,
-- each with its own regeneration attempt history).
--
-- NOTE: this block was rewritten one-time when blog seeds were
-- introduced (the old per-user keyword bank / cluster-as-unit model is
-- gone). The DROP TABLE statements below make this section NON-additive:
-- re-applying schema.sql wipes seeds/keywords/clusters/images. Safe on
-- the local dev DB (no production data); do not run against prod as-is.
-- =========================================================

-- Old model tables — dropped so the reshaped versions below recreate
-- cleanly. CASCADE clears dependent rows/indexes/FKs.
DROP TABLE IF EXISTS blog_cluster_images   CASCADE;
DROP TABLE IF EXISTS blog_keyword_clusters CASCADE;
DROP TABLE IF EXISTS blog_keywords         CASCADE;
DROP TABLE IF EXISTS blog_clusters         CASCADE;

-- Top-level seed. wizard_step tracks the furthest-reached step for
-- resumability: cluster → serp → images → generate → done.
CREATE TABLE IF NOT EXISTS blog_seeds (
  id                 BIGSERIAL    PRIMARY KEY,
  user_id            BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title              TEXT         NOT NULL,
  intent             TEXT,
  starter_keywords   TEXT,
  wizard_step        TEXT         NOT NULL DEFAULT 'cluster',
  status             TEXT         NOT NULL DEFAULT 'draft',
  model_used         TEXT,
  serp_analysis_json JSONB,
  serp_analyzed_at   TIMESTAMPTZ,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS blog_seeds_user_idx
  ON blog_seeds (user_id, created_at DESC);

-- Back-link from a generated post to its seed (mirrors the per-instance
-- link, handy for the posts list).
ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS seed_id BIGINT REFERENCES blog_seeds(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS blog_posts_seed_idx ON blog_posts (seed_id);

-- The cluster: exactly one per seed (the AI-expanded keyword set).
CREATE TABLE IF NOT EXISTS blog_clusters (
  id          BIGSERIAL    PRIMARY KEY,
  seed_id     BIGINT       NOT NULL REFERENCES blog_seeds(id) ON DELETE CASCADE,
  name        TEXT         NOT NULL,
  intent      TEXT,
  model_used  TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS blog_clusters_seed_idx ON blog_clusters (seed_id);

-- Per-seed keywords. is_starter = user-typed; is_primary = the anchor
-- (one per seed, enforced in the action). Phrase unique within a seed.
CREATE TABLE IF NOT EXISTS blog_keywords (
  id          BIGSERIAL    PRIMARY KEY,
  seed_id     BIGINT       NOT NULL REFERENCES blog_seeds(id) ON DELETE CASCADE,
  phrase      TEXT         NOT NULL,
  intent      TEXT,
  is_primary  BOOLEAN      NOT NULL DEFAULT FALSE,
  is_starter  BOOLEAN      NOT NULL DEFAULT FALSE,
  notes       TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS blog_keywords_seed_phrase_idx
  ON blog_keywords (seed_id, LOWER(phrase));

-- Image pool — one per seed. Slots 0-4 are primary candidates; slot >= 5
-- are custom-keyword extras. Shared across every instance from the seed.
CREATE TABLE IF NOT EXISTS blog_seed_images (
  id               BIGSERIAL    PRIMARY KEY,
  seed_id          BIGINT       NOT NULL
                                REFERENCES blog_seeds(id) ON DELETE CASCADE,
  slot             INTEGER      NOT NULL DEFAULT 0,
  include_in_post  BOOLEAN      NOT NULL DEFAULT TRUE,
  source           TEXT         NOT NULL DEFAULT 'pexels',
  source_id        TEXT         NOT NULL,
  url_large        TEXT         NOT NULL,
  url_original     TEXT,
  source_url       TEXT,
  photographer     TEXT,
  photographer_url TEXT,
  alt              TEXT,
  page_offset      INTEGER      NOT NULL DEFAULT 1,
  search_phrase    TEXT,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS blog_seed_images_slot_idx
  ON blog_seed_images (seed_id, slot);

-- A blog instance = one generated post for a seed (a distinct angle).
-- A seed can have many. chosen_attempt_id points at the kept generation.
CREATE TABLE IF NOT EXISTS blog_instances (
  id                BIGSERIAL    PRIMARY KEY,
  seed_id           BIGINT       NOT NULL REFERENCES blog_seeds(id) ON DELETE CASCADE,
  angle             TEXT,
  generated_post_id BIGINT       REFERENCES blog_posts(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS blog_instances_seed_idx
  ON blog_instances (seed_id, created_at DESC);

-- Regeneration history: every "generate"/"re-roll" of an instance records
-- one attempt (success or error) so the user can pick the best.
CREATE TABLE IF NOT EXISTS blog_generation_attempts (
  id            BIGSERIAL    PRIMARY KEY,
  instance_id   BIGINT       NOT NULL REFERENCES blog_instances(id) ON DELETE CASCADE,
  status        TEXT         NOT NULL DEFAULT 'pending',
  model_used    TEXT,
  response_text TEXT,
  error         TEXT,
  post_id       BIGINT       REFERENCES blog_posts(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS blog_generation_attempts_instance_idx
  ON blog_generation_attempts (instance_id, created_at DESC);

-- Circular FK resolved after both tables exist.
ALTER TABLE blog_instances
  ADD COLUMN IF NOT EXISTS chosen_attempt_id BIGINT
    REFERENCES blog_generation_attempts(id) ON DELETE SET NULL;

-- =========================================================
-- Blog Builder settings (single-row config)
-- =========================================================
CREATE TABLE IF NOT EXISTS blog_builder_settings (
  id                 INTEGER     PRIMARY KEY CHECK (id = 1),
  post_max_tokens    INTEGER     NOT NULL DEFAULT 3000,
  serp_max_tokens    INTEGER     NOT NULL DEFAULT 3500,
  cluster_max_tokens INTEGER     NOT NULL DEFAULT 1500,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The old editorial "reference budgets" (voice/humour/opinions/stats/stories)
-- were retired with the file-based references; generation now draws its
-- editorial inputs from the per-user brand_profiles table. Drop them if an
-- earlier schema created them.
ALTER TABLE blog_builder_settings
  DROP COLUMN IF EXISTS voice_budget,
  DROP COLUMN IF EXISTS humour_budget,
  DROP COLUMN IF EXISTS opinions_budget,
  DROP COLUMN IF EXISTS stats_budget,
  DROP COLUMN IF EXISTS stories_budget;

INSERT INTO blog_builder_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- =========================================================
-- Brand profiles — per-user editorial identity that drives the
-- AI prompts (replaces the old file-based voice/humour/etc.).
-- One row per user; created lazily on first save.
-- =========================================================
CREATE TABLE IF NOT EXISTS brand_profiles (
  user_id     BIGINT      PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  brand_name  TEXT,
  site_url    TEXT,
  audience    TEXT,
  voice       TEXT,
  perspective TEXT,
  avoid       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Restored from the old file-based references (humour.md / stats.md /
-- stories.md): humour is a system-prompt section alongside voice; stats and
-- stories are brand material injected into the user prompt.
ALTER TABLE brand_profiles
  ADD COLUMN IF NOT EXISTS humour  TEXT,
  ADD COLUMN IF NOT EXISTS stats   TEXT,
  ADD COLUMN IF NOT EXISTS stories TEXT;

-- =========================================================
-- Site settings (single-row, keyed at id=1)
-- =========================================================
CREATE TABLE IF NOT EXISTS site_settings (
  id              INTEGER     PRIMARY KEY CHECK (id = 1),
  allow_indexing  BOOLEAN     NOT NULL DEFAULT FALSE,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS maintenance_at TIMESTAMPTZ;

INSERT INTO site_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- =========================================================
-- Captured outbound email (local/test, EMAIL_CAPTURE=1)
-- =========================================================
CREATE TABLE IF NOT EXISTS sent_emails (
  id         BIGSERIAL   PRIMARY KEY,
  to_email   TEXT        NOT NULL,
  subject    TEXT        NOT NULL,
  html       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS sent_emails_to_recent_idx
  ON sent_emails (to_email, created_at DESC);

-- =========================================================
-- Error log — external API failures (Anthropic, Pexels, …)
-- surfaced to admins. Users only ever see a generic "contact
-- support" message; the real detail lands here. seed_id is a loose
-- reference (no FK) so the log survives seed deletion.
-- =========================================================
CREATE TABLE IF NOT EXISTS error_log (
  id         BIGSERIAL   PRIMARY KEY,
  user_id    BIGINT      REFERENCES users(id) ON DELETE SET NULL,
  source     TEXT        NOT NULL,
  context    TEXT,
  message    TEXT        NOT NULL,
  detail     TEXT,
  seed_id    BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS error_log_recent_idx
  ON error_log (created_at DESC);

-- Backfill existing accounts as verified — pre-rollout users shouldn't be
-- nagged after the fact.
UPDATE users SET email_verified_at = COALESCE(email_verified_at, created_at);
