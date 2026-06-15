# Creator OS Alpha — Sasha Edition

Internal SaaS-style MVP for operating one virtual creator (**Sasha Van**).
This repository contains **Sprint 1 (Foundation)** and **Sprint 2 (Data model + CRUD)**.

> Status: the stack runs locally with Docker Compose, migrations + seed run
> automatically, the operator can log in, and **Sasha appears in the dashboard**.
> External providers (Google generation, Buffer publishing) are **mocked** — no
> real third-party API calls are made yet.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind |
| Backend | FastAPI + SQLAlchemy 2.x + Pydantic v2 |
| Migrations | Alembic |
| Database | PostgreSQL 16 |
| Queue | Redis + RQ (scaffolded) |
| Storage | S3-compatible abstraction; MinIO locally |
| Auth | Email/password → JWT (single operator) |
| Dev | Docker Compose |

## Monorepo layout

```
creator-os/
  apps/
    api/      FastAPI backend (models, schemas, routes, services, seed, tests, Alembic)
    web/      Next.js dashboard shell
  infra/
    docker-compose.yml
  docs/       PRD, schema spec, RUNBOOK, AGENTS
  scripts/    seed.py
  .env.example
  Makefile
```

## Quick start

Requires Docker + Docker Compose.

```bash
cd creator-os
cp .env.example .env        # adjust ADMIN_EMAIL / ADMIN_PASSWORD if you like
make dev                    # build + start postgres, redis, minio, api, worker, web
```

`make dev` (or `docker compose -f infra/docker-compose.yml up --build`) starts the
whole stack. On boot the **api** container automatically:

1. waits for Postgres,
2. runs `alembic upgrade head`,
3. seeds the workspace, admin user, Sasha, identity profile, pillars, and prompt
   templates.

Then open:

- **Dashboard:** http://localhost:3000  → log in → Sasha is the active creator
- **API docs (OpenAPI):** http://localhost:8000/docs
- **API health:** http://localhost:8000/health
- **MinIO console:** http://localhost:9001 (minioadmin / minioadmin)

### Log in

Use the seeded operator credentials from `.env`:

```
email:    admin@example.com      (ADMIN_EMAIL)
password: change-me              (ADMIN_PASSWORD)
```

## Migrations & seed (manual)

The api container runs these automatically, but you can run them by hand:

```bash
make migrate          # docker compose exec api alembic upgrade head
make seed             # docker compose exec api python -m app.seed.seed_alpha
```

The seed is idempotent — running it again will not duplicate Sasha.

To rebuild the database from scratch (drops volumes):

```bash
make reset
```

## Tests

```bash
make test             # runs pytest inside the api container against Postgres
```

Covered: auth login, Sasha seed, create idea, mock generation job → asset,
approve asset, create post from asset, **scheduling is rejected for unapproved
posts**, post-approval requires approved assets, tracking redirect records an event.

## Running the API locally without Docker (optional)

```bash
cd apps/api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export $(grep -v '^#' ../.env | xargs)   # or set DATABASE_URL etc.
alembic upgrade head
python -m app.seed.seed_alpha
uvicorn app.main:app --reload
```

## Provider configuration

Providers sit behind interfaces (`app/services/{generation,publishing,analytics,storage}`).
The active implementation is chosen by env vars:

```
GENERATION_PROVIDER=mock     # mock (default) | google (skeleton, raises if used)
PUBLISHING_PROVIDER=mock     # mock (default)  | buffer (future)
ANALYTICS_PROVIDER=mock
STORAGE_PROVIDER=s3          # MinIO/S3
```

Real Google and Buffer integrations are intentionally **not** implemented in this
sprint. The skeletons document the interface and raise a clear error if selected.

## What works in this sprint

- Monorepo + Docker Compose (Postgres, Redis, MinIO, API, worker, web)
- All 26 SQLAlchemy models + Alembic initial migration
- Simple JWT auth for one operator
- Seed: workspace, admin, Sasha, identity profile, 5 content pillars, 8 prompt templates, tracking link
- CRUD endpoints for characters (incl. identity + pillars), ideas, prompt templates,
  campaigns, assets, posts
- Asset upload to MinIO, approve/reject, versions
- Mock generation job → creates asset + version records
- Approval gates: a post can only be approved when its assets are approved, and only
  approved posts can be scheduled
- Public tracking redirect `GET /go/{slug}` that records click events
- Dashboard shell with sidebar, login, dashboard cards, Sasha profile, assets, posts, ideas

## Next steps (Sprint 3 — Identity Lab + assets)

See `docs/01_PRD_Creator_OS_Alpha_Sasha_Edition.md` §18. Recommended next:

1. Identity Lab UI to generate variants and mark 8–12 golden references.
2. Wire generation jobs through the RQ worker instead of inline execution.
3. Implement the real Google generation provider behind `GENERATION_PROVIDER=google`.
4. Asset detail slide-over with version history and prompt metadata.
