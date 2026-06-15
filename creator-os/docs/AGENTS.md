# AGENTS.md — guidance for AI agents working in this repo

This is **Creator OS Alpha — Sasha Edition**. Read `docs/01_PRD_*` and
`docs/02_SCHEMA_*` before making non-trivial changes.

## Ground rules (from the PRD)

1. Keep the system a **copilot**, not an autonomous publisher.
2. Never publish unless a post has status `post_approved`.
3. Persist every prompt, provider, model, input, output, version, and job result.
4. Put external integrations behind provider interfaces
   (`app/services/{generation,publishing,analytics,storage}`); never call vendor
   APIs from UI components.
5. Keep secrets out of git. Use `.env` (gitignored); `.env.example` is the template.
6. Public captions are English. Internal UI is English-first.
7. The MVP runs with **mock providers** and no real API keys.

## Architecture map

- `apps/api/app/models/` — SQLAlchemy 2.x models (one file per domain).
- `apps/api/app/schemas/` — Pydantic v2 create/update/read schemas.
- `apps/api/app/api/routes/` — FastAPI routers (REST; OpenAPI auto-generated).
- `apps/api/app/services/` — business logic + provider abstractions + approval gates.
- `apps/api/app/seed/` — Sasha + workspace + templates seed (idempotent).
- `apps/api/alembic/` — migrations; `0001_initial` builds the full schema.
- `apps/web/app/` — Next.js App Router pages; `lib/api.ts` is the typed client.

## Conventions

- UUID primary keys, `created_at`/`updated_at` on main tables.
- Enum-style workflow states are stored as indexed VARCHAR; Python `StrEnum`
  values live in `app/models/enums.py`.
- JSONB columns are mapped as the Python attribute `metadata_` (column `metadata`)
  and exposed as `metadata` in read schemas via alias.
- Add a router to `app/main.py` when you create a new route module.

## Definition of done for a slice

After each vertical slice, report: what changed, how to run it, what to test
manually, known gaps, and next recommended tasks.
