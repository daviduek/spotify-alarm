# Creator OS Alpha - SQL Schema + SQLAlchemy Implementation Spec

**Document type:** Database schema and backend model specification for Claude Code  
**Version:** 1.0  
**Owner:** David Duek  
**Primary builder:** Claude Code / Codex  
**Date:** 2026-06-15  
**Companion PRD:** `01_PRD_Creator_OS_Alpha_Sasha_Edition.md`

---

## 0. Claude Code instructions

Build the backend data layer for **Creator OS Alpha - Sasha Edition** using this schema.

### Required implementation choices

- PostgreSQL
- SQLAlchemy 2.x typed declarative models
- Alembic migrations
- Pydantic v2 schemas
- UUID primary keys
- `created_at`, `updated_at` on every main table
- Soft delete only where useful; do not overcomplicate
- JSONB for flexible metadata fields
- Explicit enums for workflow states
- Indexes for workflow queries and analytics queries
- Use one default workspace and one default user in MVP

### Implementation deliverables

1. `models/*.py`
2. `schemas/*.py`
3. `repositories` or service-layer CRUD helpers
4. Alembic initial migration
5. Seed script for Sasha, default workspace, admin user, prompt templates
6. API endpoints listed in the PRD
7. Tests for core workflows

### Important architecture rule

The MVP uses only one creator, Sasha Van, but the schema must support more creators later without a rewrite. Use `character_id` everywhere content belongs to a creator.

---

## 1. Database conventions

### 1.1 UUID generation

Use PostgreSQL `gen_random_uuid()` from `pgcrypto`.

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

### 1.2 Timestamps

Use timezone-aware timestamps.

```sql
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

In SQLAlchemy, implement an `updated_at` update hook or use SQLAlchemy `onupdate=func.now()`.

### 1.3 Naming

- Tables: plural snake_case
- Columns: snake_case
- Enums: snake_case type names
- Foreign keys: `{entity}_id`

### 1.4 JSONB usage

Use JSONB for:

- provider request/response metadata
- prompt variables
- generation parameters
- flexible social metrics
- platform-specific settings
- identity detail blocks

Do not put core workflow states only in JSONB. States must be indexed columns.

---

## 2. Workflow states and enums

Use PostgreSQL enums or application-level string enums. If PostgreSQL enums slow down development, use `TEXT CHECK (...)` constraints. For Alpha, PostgreSQL enums are fine.

### 2.1 Core enums

```sql
CREATE TYPE workspace_status AS ENUM ('active', 'archived');
CREATE TYPE user_status AS ENUM ('active', 'disabled');
CREATE TYPE character_status AS ENUM ('draft', 'active', 'paused', 'archived');
CREATE TYPE idea_status AS ENUM ('backlog', 'selected', 'generated', 'converted_to_post', 'archived');
CREATE TYPE asset_type AS ENUM ('image', 'video', 'audio', 'document', 'other');
CREATE TYPE asset_status AS ENUM ('uploaded', 'generated', 'shortlisted', 'approved', 'rejected', 'archived');
CREATE TYPE asset_source_type AS ENUM ('generated', 'uploaded', 'licensed', 'external_tool', 'other');
CREATE TYPE post_status AS ENUM ('idea', 'generated', 'asset_approved', 'post_draft', 'post_approved', 'scheduled', 'published', 'failed', 'measured', 'archived');
CREATE TYPE platform_type AS ENUM ('instagram', 'tiktok', 'linktree', 'onlyfans', 'fanvue', 'fansly', 'website', 'other');
CREATE TYPE provider_type AS ENUM ('google', 'buffer', 'posthog', 's3', 'minio', 'comfyui', 'manual', 'mock', 'other');
CREATE TYPE job_status AS ENUM ('queued', 'running', 'completed', 'failed', 'cancelled');
CREATE TYPE generation_job_type AS ENUM ('text_to_image', 'image_to_image', 'text_to_video', 'image_to_video', 'caption', 'prompt', 'post_package');
CREATE TYPE publishing_job_status AS ENUM ('queued', 'scheduled', 'published', 'failed', 'cancelled');
CREATE TYPE metric_source AS ENUM ('api', 'manual', 'tracking', 'import', 'estimated');
CREATE TYPE campaign_status AS ENUM ('draft', 'active', 'paused', 'completed', 'archived');
CREATE TYPE tracking_link_status AS ENUM ('active', 'paused', 'archived');
```

---

## 3. Relationship overview

```text
workspace
  -> users
  -> characters
      -> character_identity_profiles
      -> character_content_pillars
      -> content_ideas
      -> prompt_templates
      -> generation_jobs
      -> assets
          -> asset_versions
      -> posts
          -> post_assets
          -> publishing_jobs
          -> post_metrics
      -> daily_character_metrics
      -> campaigns
      -> tracking_links
          -> tracking_events
      -> monetization_links
```

---

## 4. Core schema DDL

This DDL can be used as the basis for Alembic migration `0001_initial.py`.

---

## 4.1 Workspaces

Even though Alpha has one user and one workspace, keep this table for SaaS compatibility.

```sql
CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    status workspace_status NOT NULL DEFAULT 'active',
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 4.2 Users

Simple single-role operator for MVP.

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'admin',
    status user_status NOT NULL DEFAULT 'active',
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_workspace_id ON users(workspace_id);
```

---

## 4.3 Characters

Stores Sasha and future creators.

```sql
CREATE TABLE characters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    status character_status NOT NULL DEFAULT 'draft',
    market TEXT NOT NULL DEFAULT 'USA',
    language TEXT NOT NULL DEFAULT 'English',
    city_base TEXT,
    secondary_cities TEXT[] NOT NULL DEFAULT '{}',
    age_apparent INTEGER,
    archetype TEXT,
    profession_strategy TEXT,
    public_bio TEXT,
    narrative_summary TEXT,
    personality_traits TEXT[] NOT NULL DEFAULT '{}',
    tone_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
    content_strategy JSONB NOT NULL DEFAULT '{}'::jsonb,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(workspace_id, slug)
);

CREATE INDEX idx_characters_workspace_id ON characters(workspace_id);
CREATE INDEX idx_characters_status ON characters(status);
```

---

## 4.4 Character identity profiles

The Identity Lock for Sasha.

```sql
CREATE TABLE character_identity_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id UUID NOT NULL UNIQUE REFERENCES characters(id) ON DELETE CASCADE,
    face_description TEXT,
    body_description TEXT,
    hair_description TEXT,
    skin_tone_description TEXT,
    makeup_style TEXT,
    wardrobe_style TEXT,
    luxury_level TEXT,
    travel_style TEXT,
    visual_aesthetic TEXT,
    prompt_anchor TEXT,
    negative_identity_constraints TEXT,
    forbidden_variations TEXT[] NOT NULL DEFAULT '{}',
    visual_qc_notes TEXT,
    identity_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 4.5 Character content pillars

Normalize content pillar weights so analytics can aggregate by pillar.

```sql
CREATE TABLE character_content_pillars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    weight_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
    description TEXT,
    examples TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(character_id, slug)
);

CREATE INDEX idx_character_content_pillars_character_id ON character_content_pillars(character_id);
```

---

## 4.6 Campaigns

Use campaigns for weekly experiments, launch pushes, or format tests.

```sql
CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    character_id UUID REFERENCES characters(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    status campaign_status NOT NULL DEFAULT 'draft',
    objective TEXT,
    hypothesis TEXT,
    start_date DATE,
    end_date DATE,
    notes TEXT,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(workspace_id, slug)
);

CREATE INDEX idx_campaigns_workspace_id ON campaigns(workspace_id);
CREATE INDEX idx_campaigns_character_id ON campaigns(character_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);
```

---

## 4.7 Content ideas

```sql
CREATE TABLE content_ideas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    pillar_slug TEXT,
    title TEXT NOT NULL,
    description TEXT,
    objective TEXT,
    format TEXT,
    hook TEXT,
    priority INTEGER NOT NULL DEFAULT 3,
    status idea_status NOT NULL DEFAULT 'backlog',
    suggested_platforms platform_type[] NOT NULL DEFAULT '{}',
    scheduled_for TIMESTAMPTZ,
    source TEXT NOT NULL DEFAULT 'manual',
    generation_notes TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_content_ideas_workspace_id ON content_ideas(workspace_id);
CREATE INDEX idx_content_ideas_character_id ON content_ideas(character_id);
CREATE INDEX idx_content_ideas_campaign_id ON content_ideas(campaign_id);
CREATE INDEX idx_content_ideas_status ON content_ideas(status);
CREATE INDEX idx_content_ideas_priority ON content_ideas(priority);
```

---

## 4.8 Prompt templates

```sql
CREATE TABLE prompt_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    character_id UUID REFERENCES characters(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    template_type TEXT NOT NULL DEFAULT 'visual',
    pillar_slug TEXT,
    provider_type provider_type NOT NULL DEFAULT 'google',
    model_hint TEXT,
    prompt_body TEXT NOT NULL,
    constraints_body TEXT,
    variables_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
    output_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
    default_parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(workspace_id, slug)
);

CREATE INDEX idx_prompt_templates_workspace_id ON prompt_templates(workspace_id);
CREATE INDEX idx_prompt_templates_character_id ON prompt_templates(character_id);
CREATE INDEX idx_prompt_templates_slug ON prompt_templates(slug);
CREATE INDEX idx_prompt_templates_active ON prompt_templates(is_active);
```

---

## 4.9 Generation jobs

All generation requests go through jobs.

```sql
CREATE TABLE generation_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    character_id UUID REFERENCES characters(id) ON DELETE SET NULL,
    content_idea_id UUID REFERENCES content_ideas(id) ON DELETE SET NULL,
    prompt_template_id UUID REFERENCES prompt_templates(id) ON DELETE SET NULL,
    job_type generation_job_type NOT NULL,
    status job_status NOT NULL DEFAULT 'queued',
    provider_type provider_type NOT NULL DEFAULT 'google',
    provider_model TEXT,
    prompt_text TEXT,
    negative_prompt_text TEXT,
    input_asset_ids UUID[] NOT NULL DEFAULT '{}',
    input_reference_urls TEXT[] NOT NULL DEFAULT '{}',
    requested_output_count INTEGER NOT NULL DEFAULT 1,
    parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
    provider_request JSONB NOT NULL DEFAULT '{}'::jsonb,
    provider_response JSONB NOT NULL DEFAULT '{}'::jsonb,
    external_job_id TEXT,
    error_code TEXT,
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_generation_jobs_workspace_id ON generation_jobs(workspace_id);
CREATE INDEX idx_generation_jobs_character_id ON generation_jobs(character_id);
CREATE INDEX idx_generation_jobs_status ON generation_jobs(status);
CREATE INDEX idx_generation_jobs_provider_type ON generation_jobs(provider_type);
CREATE INDEX idx_generation_jobs_created_at ON generation_jobs(created_at DESC);
```

---

## 4.10 Assets

One logical asset can have multiple versions.

```sql
CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    character_id UUID REFERENCES characters(id) ON DELETE SET NULL,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    generation_job_id UUID REFERENCES generation_jobs(id) ON DELETE SET NULL,
    parent_asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
    asset_type asset_type NOT NULL,
    source_type asset_source_type NOT NULL DEFAULT 'uploaded',
    status asset_status NOT NULL DEFAULT 'uploaded',
    title TEXT,
    description TEXT,
    provider_type provider_type,
    provider_model TEXT,
    original_prompt TEXT,
    constraints_text TEXT,
    storage_key TEXT,
    public_url TEXT,
    mime_type TEXT,
    file_size_bytes BIGINT,
    duration_seconds NUMERIC(10,2),
    width INTEGER,
    height INTEGER,
    aspect_ratio TEXT,
    platform_fit platform_type[] NOT NULL DEFAULT '{}',
    risk_recommendation TEXT,
    tags TEXT[] NOT NULL DEFAULT '{}',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    approved_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_assets_workspace_id ON assets(workspace_id);
CREATE INDEX idx_assets_character_id ON assets(character_id);
CREATE INDEX idx_assets_campaign_id ON assets(campaign_id);
CREATE INDEX idx_assets_status ON assets(status);
CREATE INDEX idx_assets_asset_type ON assets(asset_type);
CREATE INDEX idx_assets_created_at ON assets(created_at DESC);
CREATE INDEX idx_assets_tags ON assets USING GIN(tags);
```

---

## 4.11 Asset versions

Every edit/output should be versioned.

```sql
CREATE TABLE asset_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    generation_job_id UUID REFERENCES generation_jobs(id) ON DELETE SET NULL,
    storage_key TEXT,
    public_url TEXT,
    mime_type TEXT,
    file_size_bytes BIGINT,
    duration_seconds NUMERIC(10,2),
    width INTEGER,
    height INTEGER,
    aspect_ratio TEXT,
    prompt_text TEXT,
    changes_summary TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(asset_id, version_number)
);

CREATE INDEX idx_asset_versions_asset_id ON asset_versions(asset_id);
CREATE INDEX idx_asset_versions_generation_job_id ON asset_versions(generation_job_id);
```

---

## 4.12 Character reference assets

Golden references used for identity consistency.

```sql
CREATE TABLE character_reference_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    label TEXT,
    reference_type TEXT NOT NULL DEFAULT 'golden_reference',
    weight NUMERIC(5,2) NOT NULL DEFAULT 1.0,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(character_id, asset_id, reference_type)
);

CREATE INDEX idx_character_reference_assets_character_id ON character_reference_assets(character_id);
CREATE INDEX idx_character_reference_assets_asset_id ON character_reference_assets(asset_id);
CREATE INDEX idx_character_reference_assets_active ON character_reference_assets(is_active);
```

---

## 4.13 Platform accounts

Connected social or monetization accounts.

```sql
CREATE TABLE platform_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    character_id UUID REFERENCES characters(id) ON DELETE SET NULL,
    platform platform_type NOT NULL,
    provider_type provider_type NOT NULL DEFAULT 'buffer',
    display_name TEXT,
    handle TEXT,
    external_account_id TEXT,
    external_channel_id TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    access_token_encrypted TEXT,
    refresh_token_encrypted TEXT,
    token_expires_at TIMESTAMPTZ,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    connected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_platform_accounts_workspace_id ON platform_accounts(workspace_id);
CREATE INDEX idx_platform_accounts_character_id ON platform_accounts(character_id);
CREATE INDEX idx_platform_accounts_platform ON platform_accounts(platform);
CREATE INDEX idx_platform_accounts_provider_type ON platform_accounts(provider_type);
```

Note: In Alpha, storing provider credentials in env is acceptable. If tokens are stored in DB, encrypt them.

---

## 4.14 Posts

A post is a channel-specific publication package. One asset can be used in many posts.

```sql
CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    content_idea_id UUID REFERENCES content_ideas(id) ON DELETE SET NULL,
    platform_account_id UUID REFERENCES platform_accounts(id) ON DELETE SET NULL,
    platform platform_type NOT NULL,
    status post_status NOT NULL DEFAULT 'post_draft',
    title TEXT,
    caption TEXT,
    hashtags TEXT[] NOT NULL DEFAULT '{}',
    cta TEXT,
    pillar_slug TEXT,
    format TEXT,
    hook_type TEXT,
    caption_type TEXT,
    asset_type asset_type,
    scheduled_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    external_post_id TEXT,
    external_url TEXT,
    tracking_link_id UUID,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    utm_content TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    approved_at TIMESTAMPTZ,
    approved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_posts_workspace_id ON posts(workspace_id);
CREATE INDEX idx_posts_character_id ON posts(character_id);
CREATE INDEX idx_posts_campaign_id ON posts(campaign_id);
CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_posts_platform ON posts(platform);
CREATE INDEX idx_posts_scheduled_at ON posts(scheduled_at);
CREATE INDEX idx_posts_published_at ON posts(published_at DESC);
CREATE INDEX idx_posts_pillar_slug ON posts(pillar_slug);
```

Add FK to tracking links after tracking_links table exists or define tracking_links before posts. In Alembic, either order correctly or use `op.create_foreign_key` later.

---

## 4.15 Post assets

Many-to-many between posts and assets.

```sql
CREATE TABLE post_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
    asset_version_id UUID REFERENCES asset_versions(id) ON DELETE SET NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    role TEXT NOT NULL DEFAULT 'primary',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(post_id, asset_id, role)
);

CREATE INDEX idx_post_assets_post_id ON post_assets(post_id);
CREATE INDEX idx_post_assets_asset_id ON post_assets(asset_id);
```

---

## 4.16 Publishing jobs

```sql
CREATE TABLE publishing_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    platform_account_id UUID REFERENCES platform_accounts(id) ON DELETE SET NULL,
    provider_type provider_type NOT NULL DEFAULT 'buffer',
    status publishing_job_status NOT NULL DEFAULT 'queued',
    scheduled_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    external_job_id TEXT,
    external_post_id TEXT,
    external_url TEXT,
    provider_request JSONB NOT NULL DEFAULT '{}'::jsonb,
    provider_response JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_code TEXT,
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_publishing_jobs_workspace_id ON publishing_jobs(workspace_id);
CREATE INDEX idx_publishing_jobs_post_id ON publishing_jobs(post_id);
CREATE INDEX idx_publishing_jobs_status ON publishing_jobs(status);
CREATE INDEX idx_publishing_jobs_provider_type ON publishing_jobs(provider_type);
CREATE INDEX idx_publishing_jobs_scheduled_at ON publishing_jobs(scheduled_at);
```

---

## 4.17 Tracking links

```sql
CREATE TABLE tracking_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    character_id UUID REFERENCES characters(id) ON DELETE SET NULL,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
    slug TEXT NOT NULL,
    target_url TEXT NOT NULL,
    status tracking_link_status NOT NULL DEFAULT 'active',
    default_utm_source TEXT,
    default_utm_medium TEXT,
    default_utm_campaign TEXT,
    default_utm_content TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(workspace_id, slug)
);

CREATE INDEX idx_tracking_links_workspace_id ON tracking_links(workspace_id);
CREATE INDEX idx_tracking_links_character_id ON tracking_links(character_id);
CREATE INDEX idx_tracking_links_campaign_id ON tracking_links(campaign_id);
CREATE INDEX idx_tracking_links_post_id ON tracking_links(post_id);
CREATE INDEX idx_tracking_links_slug ON tracking_links(slug);
```

If `posts.tracking_link_id` is used, add FK after both tables exist:

```sql
ALTER TABLE posts
ADD CONSTRAINT fk_posts_tracking_link_id
FOREIGN KEY (tracking_link_id) REFERENCES tracking_links(id) ON DELETE SET NULL;
```

---

## 4.18 Tracking events

```sql
CREATE TABLE tracking_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    tracking_link_id UUID NOT NULL REFERENCES tracking_links(id) ON DELETE CASCADE,
    character_id UUID REFERENCES characters(id) ON DELETE SET NULL,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
    source_platform platform_type,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    utm_content TEXT,
    referrer TEXT,
    user_agent TEXT,
    ip_hash TEXT,
    country TEXT,
    device_type TEXT,
    browser TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tracking_events_workspace_id ON tracking_events(workspace_id);
CREATE INDEX idx_tracking_events_tracking_link_id ON tracking_events(tracking_link_id);
CREATE INDEX idx_tracking_events_character_id ON tracking_events(character_id);
CREATE INDEX idx_tracking_events_campaign_id ON tracking_events(campaign_id);
CREATE INDEX idx_tracking_events_post_id ON tracking_events(post_id);
CREATE INDEX idx_tracking_events_clicked_at ON tracking_events(clicked_at DESC);
CREATE INDEX idx_tracking_events_utm_source ON tracking_events(utm_source);
```

---

## 4.19 Post metrics

Metrics stored at post level. Can be manual, API, tracking, or import.

```sql
CREATE TABLE post_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    platform platform_type NOT NULL,
    source metric_source NOT NULL DEFAULT 'manual',
    measured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    views BIGINT NOT NULL DEFAULT 0,
    reach BIGINT NOT NULL DEFAULT 0,
    likes BIGINT NOT NULL DEFAULT 0,
    comments BIGINT NOT NULL DEFAULT 0,
    shares BIGINT NOT NULL DEFAULT 0,
    saves BIGINT NOT NULL DEFAULT 0,
    followers_gained BIGINT NOT NULL DEFAULT 0,
    profile_visits BIGINT NOT NULL DEFAULT 0,
    link_clicks BIGINT NOT NULL DEFAULT 0,
    dm_count_manual BIGINT NOT NULL DEFAULT 0,
    engagement_rate NUMERIC(8,4),
    profile_visit_rate NUMERIC(8,4),
    link_click_rate NUMERIC(8,4),
    growth_score NUMERIC(10,4),
    raw_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_post_metrics_workspace_id ON post_metrics(workspace_id);
CREATE INDEX idx_post_metrics_post_id ON post_metrics(post_id);
CREATE INDEX idx_post_metrics_platform ON post_metrics(platform);
CREATE INDEX idx_post_metrics_measured_at ON post_metrics(measured_at DESC);
CREATE INDEX idx_post_metrics_growth_score ON post_metrics(growth_score DESC);
```

---

## 4.20 Daily character metrics

Useful for dashboard overview and daily snapshots.

```sql
CREATE TABLE daily_character_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    metric_date DATE NOT NULL,
    platform platform_type,
    source metric_source NOT NULL DEFAULT 'manual',
    views BIGINT NOT NULL DEFAULT 0,
    reach BIGINT NOT NULL DEFAULT 0,
    likes BIGINT NOT NULL DEFAULT 0,
    comments BIGINT NOT NULL DEFAULT 0,
    shares BIGINT NOT NULL DEFAULT 0,
    saves BIGINT NOT NULL DEFAULT 0,
    followers_total BIGINT NOT NULL DEFAULT 0,
    followers_delta BIGINT NOT NULL DEFAULT 0,
    profile_visits BIGINT NOT NULL DEFAULT 0,
    link_clicks BIGINT NOT NULL DEFAULT 0,
    dm_count_manual BIGINT NOT NULL DEFAULT 0,
    published_posts_count INTEGER NOT NULL DEFAULT 0,
    raw_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(character_id, platform, metric_date)
);

CREATE INDEX idx_daily_character_metrics_workspace_id ON daily_character_metrics(workspace_id);
CREATE INDEX idx_daily_character_metrics_character_id ON daily_character_metrics(character_id);
CREATE INDEX idx_daily_character_metrics_metric_date ON daily_character_metrics(metric_date DESC);
CREATE INDEX idx_daily_character_metrics_platform ON daily_character_metrics(platform);
```

---

## 4.21 Monetization links

Do not implement deep monetization integration in Alpha, but track destinations.

```sql
CREATE TABLE monetization_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    platform platform_type NOT NULL,
    label TEXT NOT NULL,
    url TEXT NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'active',
    notes TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_monetization_links_workspace_id ON monetization_links(workspace_id);
CREATE INDEX idx_monetization_links_character_id ON monetization_links(character_id);
CREATE INDEX idx_monetization_links_platform ON monetization_links(platform);
CREATE INDEX idx_monetization_links_primary ON monetization_links(is_primary);
```

---

## 4.22 Integration connections

Stores integration configuration, not necessarily secrets. Prefer env vars for Alpha.

```sql
CREATE TABLE integration_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    provider_type provider_type NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'inactive',
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    secret_ref TEXT,
    last_tested_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(workspace_id, provider_type, name)
);

CREATE INDEX idx_integration_connections_workspace_id ON integration_connections(workspace_id);
CREATE INDEX idx_integration_connections_provider_type ON integration_connections(provider_type);
CREATE INDEX idx_integration_connections_status ON integration_connections(status);
```

---

## 4.23 Operational audit log

This is not a heavy compliance system. It is a simple operational log for debugging and traceability.

```sql
CREATE TABLE audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    action TEXT NOT NULL,
    summary TEXT,
    before_data JSONB,
    after_data JSONB,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_events_workspace_id ON audit_events(workspace_id);
CREATE INDEX idx_audit_events_user_id ON audit_events(user_id);
CREATE INDEX idx_audit_events_entity ON audit_events(entity_type, entity_id);
CREATE INDEX idx_audit_events_created_at ON audit_events(created_at DESC);
```

---

## 5. Critical business logic rules

Implement these in service layer, not just frontend.

### 5.1 Publishing approval gate

```python
if post.status != "post_approved":
    raise ValidationError("Post must be approved before publishing or scheduling.")
```

### 5.2 Asset approval gate

A post cannot be approved unless all required assets are approved.

```python
for post_asset in post.assets:
    if post_asset.asset.status != "approved":
        raise ValidationError("All post assets must be approved before approving the post.")
```

### 5.3 Asset versioning

When generation or editing creates a new file for an existing asset, create a new `asset_versions` row. Do not overwrite the previous version.

### 5.4 Tracking redirect

`GET /go/{slug}` must:

1. Find active tracking link.
2. Create tracking event.
3. Redirect to target URL.
4. Never block redirect because non-critical analytics failed. If insert fails, log and redirect anyway.

### 5.5 Growth score update

When post metrics are inserted or updated, recalculate growth score.

---

## 6. SQLAlchemy model specification

Use SQLAlchemy 2.x style.

### 6.1 Base mixins

```python
# app/models/base.py

import uuid
from datetime import datetime
from sqlalchemy import DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class UUIDPrimaryKeyMixin:
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
```

### 6.2 Python enums

```python
# app/models/enums.py

from enum import StrEnum

class CharacterStatus(StrEnum):
    DRAFT = "draft"
    ACTIVE = "active"
    PAUSED = "paused"
    ARCHIVED = "archived"

class AssetStatus(StrEnum):
    UPLOADED = "uploaded"
    GENERATED = "generated"
    SHORTLISTED = "shortlisted"
    APPROVED = "approved"
    REJECTED = "rejected"
    ARCHIVED = "archived"

class PostStatus(StrEnum):
    IDEA = "idea"
    GENERATED = "generated"
    ASSET_APPROVED = "asset_approved"
    POST_DRAFT = "post_draft"
    POST_APPROVED = "post_approved"
    SCHEDULED = "scheduled"
    PUBLISHED = "published"
    FAILED = "failed"
    MEASURED = "measured"
    ARCHIVED = "archived"
```

Implement the rest of enums matching the DDL.

### 6.3 Example model: Character

```python
# app/models/character.py

import uuid
from typing import Optional
from sqlalchemy import ForeignKey, Text, Integer
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDPrimaryKeyMixin, TimestampMixin


class Character(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "characters"

    workspace_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    slug: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="draft", index=True)
    market: Mapped[str] = mapped_column(Text, nullable=False, default="USA")
    language: Mapped[str] = mapped_column(Text, nullable=False, default="English")
    city_base: Mapped[Optional[str]] = mapped_column(Text)
    secondary_cities: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, default=list)
    age_apparent: Mapped[Optional[int]] = mapped_column(Integer)
    archetype: Mapped[Optional[str]] = mapped_column(Text)
    profession_strategy: Mapped[Optional[str]] = mapped_column(Text)
    public_bio: Mapped[Optional[str]] = mapped_column(Text)
    narrative_summary: Mapped[Optional[str]] = mapped_column(Text)
    personality_traits: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, default=list)
    tone_rules: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    content_strategy: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    notes: Mapped[Optional[str]] = mapped_column(Text)

    identity_profile: Mapped["CharacterIdentityProfile"] = relationship(back_populates="character", uselist=False)
    content_pillars: Mapped[list["CharacterContentPillar"]] = relationship(back_populates="character", cascade="all, delete-orphan")
```

Claude Code should implement all models, not only this example.

---

## 7. Pydantic schema conventions

Use separate schemas for create, update, and read.

Example:

```python
# app/schemas/character.py

from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field


class CharacterBase(BaseModel):
    name: str
    slug: str
    status: str = "draft"
    market: str = "USA"
    language: str = "English"
    city_base: Optional[str] = None
    secondary_cities: list[str] = Field(default_factory=list)
    age_apparent: Optional[int] = None
    archetype: Optional[str] = None
    profession_strategy: Optional[str] = None
    public_bio: Optional[str] = None
    narrative_summary: Optional[str] = None
    personality_traits: list[str] = Field(default_factory=list)
    tone_rules: dict = Field(default_factory=dict)
    content_strategy: dict = Field(default_factory=dict)
    notes: Optional[str] = None


class CharacterCreate(CharacterBase):
    pass


class CharacterUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    city_base: Optional[str] = None
    public_bio: Optional[str] = None
    narrative_summary: Optional[str] = None
    tone_rules: Optional[dict] = None
    content_strategy: Optional[dict] = None
    notes: Optional[str] = None


class CharacterRead(CharacterBase):
    id: UUID
    workspace_id: UUID

    class Config:
        from_attributes = True
```

---

## 8. Seed data specification

Create `scripts/seed.py` or `app/seed/seed_alpha.py`.

### 8.1 Workspace seed

```json
{
  "name": "Creator OS Alpha",
  "slug": "creator-os-alpha",
  "status": "active"
}
```

### 8.2 Admin user seed

Use env vars:

```text
ADMIN_EMAIL
ADMIN_PASSWORD
```

Hash password. Never store plaintext.

### 8.3 Sasha seed

```json
{
  "name": "Sasha Van",
  "slug": "sasha-van",
  "status": "active",
  "market": "USA",
  "language": "English",
  "city_base": "Miami, Florida",
  "secondary_cities": ["New York", "Los Angeles", "Las Vegas"],
  "age_apparent": 27,
  "archetype": "Luxury travel lifestyle businesswoman",
  "profession_strategy": "Ambiguous founder/investor/private deals narrative. Never fully explained.",
  "public_bio": "Private life. Public discipline. Miami / NYC.",
  "narrative_summary": "Sasha lives between luxury travel, private meetings, hotels, airport runs, rooftops, disciplined routines, and selective access. Her work is implied, not explained.",
  "personality_traits": ["selective", "disciplined", "aspirational", "mysterious", "high-status"],
  "tone_rules": {
    "voice": "short, confident, selective, mysterious",
    "avoid": ["needy", "desperate", "generic influencer tone", "overexplaining"],
    "phrases": [
      "Private life. Public discipline.",
      "Out of town. Still on schedule.",
      "Some meetings are better left private.",
      "Not unavailable. Just selective.",
      "Quiet moves. Loud results.",
      "The view is better after the work is done."
    ]
  },
  "content_strategy": {
    "primary_goal": "validate traffic and repeatable formats",
    "initial_platforms": ["instagram", "tiktok"],
    "content_style": "luxury travel, nightlife, hotel, airport, Miami/NYC energy",
    "posting_rule": "minimum 2 pieces per day during validation"
  }
}
```

### 8.4 Sasha identity profile seed

Start with editable placeholders. The real Identity Card will be finalized after generation/approval.

```json
{
  "face_description": "To be finalized in Identity Lab after golden references are selected.",
  "body_description": "Fit, luxury lifestyle, high-status aesthetic. Final proportions to be locked after golden references.",
  "hair_description": "To be finalized.",
  "skin_tone_description": "To be finalized.",
  "makeup_style": "Polished luxury, camera-ready, not overdone.",
  "wardrobe_style": "Luxury travel, fitted dresses, airport outfits, resort wear, premium athleisure.",
  "luxury_level": "High",
  "travel_style": "Miami, NYC, airports, hotels, rooftops, suites, cars, resort mornings.",
  "visual_aesthetic": "Modern luxury, warm night lights, glass, marble, premium travel, private life energy.",
  "prompt_anchor": "Sasha Van, luxury travel lifestyle businesswoman, Miami-based, selective and mysterious, premium hotel and airport lifestyle aesthetic.",
  "negative_identity_constraints": "Avoid changing apparent age, face structure, hair style, body type, makeup style, or luxury positioning between generations.",
  "forbidden_variations": [
    "different apparent age",
    "different face structure",
    "cheap influencer aesthetic",
    "low-quality lighting",
    "inconsistent hair",
    "cartoonish proportions",
    "visible text artifacts",
    "random logos"
  ]
}
```

### 8.5 Content pillars seed

```json
[
  {
    "name": "Travel Luxury",
    "slug": "travel_luxury",
    "weight_percent": 40,
    "description": "Airports, hotels, destination hints, private travel, luxury movement.",
    "examples": ["airport fit", "hotel suite", "Miami balcony", "NYC arrival"]
  },
  {
    "name": "Luxury Night Lifestyle",
    "slug": "luxury_night_lifestyle",
    "weight_percent": 25,
    "description": "Rooftops, dinners, cars, city lights, elegant after-hours.",
    "examples": ["rooftop after hours", "black dress mirror", "night car", "private dinner"]
  },
  {
    "name": "Fitness Premium",
    "slug": "fitness_premium",
    "weight_percent": 15,
    "description": "Premium gym, discipline, morning routine, body as habit.",
    "examples": ["hotel gym", "morning run", "post-workout", "premium athleisure"]
  },
  {
    "name": "Business Mystery",
    "slug": "business_mystery",
    "weight_percent": 10,
    "description": "Private calls, laptop, deal notes, coworking, meetings without context.",
    "examples": ["private call", "laptop in cafe", "deal notes", "meeting lobby"]
  },
  {
    "name": "Private Hints",
    "slug": "private_hints",
    "weight_percent": 10,
    "description": "Humanizing private details without making Sasha too available.",
    "examples": ["Sunday reset", "coffee", "playlist", "packing"]
  }
]
```

### 8.6 Prompt templates seed

Create one row per template.

#### Template: `travel_luxury_airport`

```text
Create a vertical 9:16 luxury travel scene for Sasha Van.
Character: {identity_prompt_anchor}
Scene: premium airport departure or private terminal energy, carry-on luggage, polished travel outfit, cinematic lighting, aspirational but candid.
Mood: selective, mysterious, high-status, out of town but still in control.
Avoid: {negative_identity_constraints}
Output should feel like a real lifestyle post, not an advertisement.
```

#### Template: `hotel_suite_mirror`

```text
Create a vertical 9:16 luxury hotel suite mirror scene for Sasha Van.
Character: {identity_prompt_anchor}
Scene: elegant hotel suite, warm lighting, travel wardrobe, mirror composition, subtle private-life energy.
Mood: intimate but not explicit for public social acquisition, polished, premium, selective.
Avoid: {negative_identity_constraints}
```

#### Template: `miami_night_car`

```text
Create a vertical 9:16 Miami night luxury car lifestyle scene for Sasha Van.
Character: {identity_prompt_anchor}
Scene: city lights, luxury car interior or arrival moment, elegant outfit, warm night reflections, after-hours energy.
Mood: powerful, selective, cinematic.
Avoid: {negative_identity_constraints}
```

#### Template: `rooftop_after_hours`

```text
Create a vertical 9:16 rooftop after-hours scene for Sasha Van.
Character: {identity_prompt_anchor}
Scene: skyline, rooftop, elegant evening outfit, city lights, post-work luxury mood.
Mood: quiet confidence, private life, high-status.
Avoid: {negative_identity_constraints}
```

#### Template: `luxury_resort_morning`

```text
Create a vertical 9:16 resort morning lifestyle scene for Sasha Van.
Character: {identity_prompt_anchor}
Scene: Miami or luxury resort balcony, morning light, coffee, premium travel atmosphere.
Mood: calm, controlled, aspirational, private morning routine.
Avoid: {negative_identity_constraints}
```

#### Template: `private_dinner_fit`

```text
Create a vertical 9:16 private dinner outfit scene for Sasha Van.
Character: {identity_prompt_anchor}
Scene: elegant restaurant arrival, luxury outfit, soft warm lighting, high-status dinner energy.
Mood: not available to everyone, refined, mysterious.
Avoid: {negative_identity_constraints}
```

#### Template: `packing_for_flight`

```text
Create a vertical 9:16 travel packing scene for Sasha Van.
Character: {identity_prompt_anchor}
Scene: luxury luggage, hotel room, outfit planning, passport/travel hints, no destination fully explained.
Mood: private, in motion, controlled.
Avoid: {negative_identity_constraints}
```

#### Template: `morning_balcony_miami`

```text
Create a vertical 9:16 Miami morning balcony scene for Sasha Van.
Character: {identity_prompt_anchor}
Scene: balcony, ocean or skyline hint, coffee, soft robe or elevated morning outfit, premium apartment or hotel atmosphere.
Mood: aspirational, quiet, private, disciplined.
Avoid: {negative_identity_constraints}
```

---

## 9. API endpoint implementation details

### 9.1 Create generation job

`POST /generation-jobs`

Request:

```json
{
  "character_id": "uuid",
  "content_idea_id": "uuid or null",
  "prompt_template_id": "uuid",
  "job_type": "text_to_image",
  "provider_type": "google",
  "requested_output_count": 4,
  "parameters": {
    "aspect_ratio": "9:16",
    "platform": "tiktok",
    "template_variables": {}
  }
}
```

Response:

```json
{
  "id": "uuid",
  "status": "queued"
}
```

Worker behavior:

1. Load job.
2. Load character + identity profile + references.
3. Render prompt template.
4. Call provider.
5. Upload outputs to storage.
6. Create assets + asset_versions.
7. Mark job completed or failed.

### 9.2 Approve asset

`POST /assets/{id}/approve`

Behavior:

```text
set status = approved
set approved_at = now
write audit event
```

### 9.3 Create post from asset

`POST /assets/{id}/create-post`

Request:

```json
{
  "platform": "instagram",
  "campaign_id": "uuid or null",
  "caption": "optional override",
  "scheduled_at": "optional ISO datetime"
}
```

Behavior:

- Reject if asset not approved unless user passes `allow_draft_from_unapproved=true` and post remains `post_draft`.
- Create post.
- Attach asset via `post_assets`.
- Generate UTM fields.
- Attach or create tracking link.

### 9.4 Approve post

`POST /posts/{id}/approve`

Behavior:

- Validate all attached assets are approved.
- Set status `post_approved`.
- Set `approved_at` and `approved_by_user_id`.

### 9.5 Schedule post

`POST /posts/{id}/schedule`

Behavior:

- Validate status `post_approved`.
- Validate platform account.
- Create publishing job.
- If scheduled_at provided, set post `scheduled_at`.
- Queue worker.

### 9.6 Tracking redirect

`GET /go/{slug}`

Behavior:

- Load active tracking link.
- Store event.
- Redirect to `target_url` with UTM params.

---

## 10. Analytics queries

### 10.1 Best posts last 30 days

```sql
SELECT
    p.id,
    p.platform,
    p.pillar_slug,
    p.format,
    p.hook_type,
    p.caption,
    pm.views,
    pm.likes,
    pm.comments,
    pm.shares,
    pm.saves,
    pm.profile_visits,
    pm.link_clicks,
    pm.growth_score,
    p.published_at
FROM posts p
JOIN post_metrics pm ON pm.post_id = p.id
WHERE p.character_id = :character_id
  AND p.published_at >= NOW() - INTERVAL '30 days'
ORDER BY pm.growth_score DESC NULLS LAST, pm.views DESC
LIMIT 20;
```

### 10.2 Performance by pillar

```sql
SELECT
    p.pillar_slug,
    COUNT(*) AS post_count,
    SUM(pm.views) AS total_views,
    SUM(pm.profile_visits) AS total_profile_visits,
    SUM(pm.link_clicks) AS total_link_clicks,
    AVG(pm.growth_score) AS avg_growth_score
FROM posts p
JOIN post_metrics pm ON pm.post_id = p.id
WHERE p.character_id = :character_id
  AND p.published_at >= NOW() - INTERVAL '30 days'
GROUP BY p.pillar_slug
ORDER BY avg_growth_score DESC NULLS LAST;
```

### 10.3 Funnel summary

```sql
SELECT
    SUM(pm.views) AS views,
    SUM(pm.profile_visits) AS profile_visits,
    SUM(pm.link_clicks) AS link_clicks,
    CASE WHEN SUM(pm.views) > 0 THEN SUM(pm.profile_visits)::numeric / SUM(pm.views) ELSE 0 END AS profile_visit_rate,
    CASE WHEN SUM(pm.profile_visits) > 0 THEN SUM(pm.link_clicks)::numeric / SUM(pm.profile_visits) ELSE 0 END AS profile_to_link_ctr
FROM posts p
JOIN post_metrics pm ON pm.post_id = p.id
WHERE p.character_id = :character_id
  AND p.published_at >= NOW() - INTERVAL '30 days';
```

### 10.4 Tracking clicks by day

```sql
SELECT
    DATE(clicked_at) AS day,
    COUNT(*) AS clicks
FROM tracking_events
WHERE character_id = :character_id
  AND clicked_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(clicked_at)
ORDER BY day;
```

---

## 11. Growth score implementation

### 11.1 First pass formula

If percentile normalization is not implemented yet:

```python
def compute_growth_score(metrics: dict) -> float:
    views = metrics.get("views", 0)
    profile_visits = metrics.get("profile_visits", 0)
    link_clicks = metrics.get("link_clicks", 0)
    shares = metrics.get("shares", 0)
    saves = metrics.get("saves", 0)

    return (
        0.001 * views +
        0.50 * profile_visits +
        1.50 * link_clicks +
        0.75 * shares +
        0.50 * saves
    )
```

### 11.2 Better formula later

Use percentile ranks within:

```text
same character
same platform
last 30 days
```

Formula:

```text
growth_score =
  0.35 * views_percentile +
  0.20 * profile_visits_percentile +
  0.25 * link_clicks_percentile +
  0.10 * shares_percentile +
  0.10 * saves_percentile
```

---

## 12. Required backend services

Implement these service classes.

### 12.1 `CharacterService`

```text
get_character
update_character
get_identity_profile
update_identity_profile
get_content_pillars
update_content_pillars
```

### 12.2 `GenerationService`

```text
create_generation_job
render_prompt_template
queue_generation_job
process_generation_job
handle_generation_success
handle_generation_failure
```

### 12.3 `AssetService`

```text
upload_asset
create_asset_from_generation
create_asset_version
approve_asset
reject_asset
set_golden_reference
```

### 12.4 `PostService`

```text
create_post
create_post_from_asset
approve_post
schedule_post
export_post_package
```

### 12.5 `PublishingService`

```text
create_publishing_job
process_publishing_job
sync_publishing_status
retry_publishing_job
```

### 12.6 `TrackingService`

```text
create_tracking_link
resolve_tracking_link
record_tracking_event
redirect
```

### 12.7 `AnalyticsService`

```text
upsert_post_metrics
upsert_daily_character_metrics
compute_growth_score
get_overview
get_best_posts
get_performance_by_pillar
```

---

## 13. Mock providers

Mock providers are mandatory for local development.

### 13.1 Mock generation provider

Behavior:

- Does not call external API.
- Creates placeholder asset metadata.
- Optionally uses local placeholder images from `/apps/api/app/static/placeholders`.
- Returns fake provider response.

### 13.2 Mock publishing provider

Behavior:

- Simulates scheduled/published status.
- Creates fake `external_post_id`.
- Does not call Buffer.

### 13.3 Mock analytics provider

Behavior:

- Generates sample metrics for testing.
- Allows analytics dashboard to work before platform APIs are connected.

---

## 14. Alembic notes

### 14.1 Initial migration order

1. Extensions
2. Enums
3. workspaces
4. users
5. characters
6. character_identity_profiles
7. character_content_pillars
8. campaigns
9. content_ideas
10. prompt_templates
11. generation_jobs
12. assets
13. asset_versions
14. character_reference_assets
15. platform_accounts
16. posts
17. post_assets
18. publishing_jobs
19. tracking_links
20. add FK from posts.tracking_link_id to tracking_links
21. tracking_events
22. post_metrics
23. daily_character_metrics
24. monetization_links
25. integration_connections
26. audit_events

### 14.2 Downgrade

Implement downgrade in reverse order for development. It does not need to preserve data.

---

## 15. Minimum tests

### 15.1 Database tests

```text
- migration applies successfully
- seed creates workspace, user, Sasha, identity profile, pillars, templates
- unique constraints work
- cascade delete works for test workspace
```

### 15.2 Service tests

```text
- cannot approve post with unapproved asset
- cannot schedule unapproved post
- can approve asset
- can create post from approved asset
- generation job mock creates asset + version
- tracking redirect stores event
- metric insert computes growth score
```

### 15.3 API tests

```text
- login returns token/session
- GET /characters returns Sasha
- PATCH /characters/{id} updates Sasha
- POST /assets/upload works with small fixture
- POST /assets/{id}/approve works
- POST /assets/{id}/create-post works
- POST /posts/{id}/approve works
- POST /posts/{id}/schedule rejects unapproved posts
- GET /go/sasha redirects and records event
```

---

## 16. Initial API response examples

### 16.1 `GET /analytics/overview`

```json
{
  "character": {
    "id": "uuid",
    "name": "Sasha Van"
  },
  "period": "last_30_days",
  "totals": {
    "posts_published": 0,
    "views": 0,
    "profile_visits": 0,
    "link_clicks": 0,
    "followers_gained": 0
  },
  "rates": {
    "profile_visit_rate": 0,
    "profile_to_link_ctr": 0
  },
  "best_posts": [],
  "performance_by_pillar": []
}
```

### 16.2 `POST /posts/{id}/export-package`

```json
{
  "post_id": "uuid",
  "platform": "tiktok",
  "asset_urls": ["signed_url"],
  "caption": "Out of town. Still on schedule.",
  "hashtags": ["#miami", "#luxurytravel", "#lifestyle"],
  "cta": "Private updates in bio.",
  "scheduled_at": "2026-06-20T18:00:00Z",
  "tracking_url": "https://go.example.com/sasha?utm_source=tiktok&utm_medium=social&utm_campaign=sasha_alpha&utm_content=post_uuid"
}
```

---

## 17. Implementation checklist for Claude Code

### P0

```text
[ ] Create SQLAlchemy models for all tables
[ ] Create Pydantic schemas
[ ] Create Alembic initial migration
[ ] Create seed script
[ ] Create CRUD endpoints
[ ] Create service methods for approval gates
[ ] Create mock generation provider
[ ] Create mock publishing provider
[ ] Create storage provider abstraction
[ ] Create tracking redirect endpoint
[ ] Create analytics queries
```

### P1

```text
[ ] Create real Google generation provider
[ ] Create real Buffer publishing provider
[ ] Create PostHog event capture
[ ] Create metric ingestion job
[ ] Create export package generator
[ ] Create growth score percentile version
```

### P2

```text
[ ] Add future ComfyUI provider skeleton
[ ] Add native TikTok provider skeleton
[ ] Add native Instagram provider skeleton
[ ] Add advanced reports
[ ] Add DM assistant data model
```

---

## 18. Final note for Claude Code

Build the simplest reliable version of this schema first. Do not over-optimize. The main thing is that the operator can create Sasha assets, approve them, turn them into posts, schedule them, track clicks, and see what works.

