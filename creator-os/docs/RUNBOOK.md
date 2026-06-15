# Creator OS Alpha — RUNBOOK

Operational notes for running the stack locally.

## Start / stop

```bash
make dev      # build + run in the foreground
make up       # detached
make down     # stop
make logs     # tail logs
make ps       # container status
```

## Services & ports

| Service | URL / port | Notes |
|---|---|---|
| web (Next.js) | http://localhost:3000 | dashboard |
| api (FastAPI) | http://localhost:8000 | `/docs`, `/health` |
| postgres | localhost:5432 | creator_os / creator_os |
| redis | localhost:6379 | RQ broker |
| minio | http://localhost:9000 | S3 API |
| minio console | http://localhost:9001 | minioadmin / minioadmin |

## Database

```bash
make migrate                 # alembic upgrade head
make seed                    # idempotent seed
make reset                   # DROP volumes, rebuild, re-migrate, re-seed
docker compose -f infra/docker-compose.yml exec postgres \
  psql -U creator_os -d creator_os
```

New migration after model changes:

```bash
docker compose -f infra/docker-compose.yml exec api \
  alembic revision -m "describe change"   # then edit the generated file
```

## Smoke test (manual)

1. `make dev`, wait for `[entrypoint] starting API…`.
2. `curl http://localhost:8000/health` → `{"status":"ok"}`.
3. Open http://localhost:3000, log in with the seeded operator.
4. Dashboard shows **Sasha Van** as the active creator.
5. Open Sasha Profile → pillars (5) and identity summary render.
6. `POST /generation-jobs` (via `/docs`) with `provider_type=mock` →
   asset appears under **Assets**; approve it; **create-post** from it.

## Troubleshooting

- **api exits immediately** — check `make logs`; usually Postgres not ready, the
  entrypoint retries for ~60s.
- **web cannot reach api** — confirm `NEXT_PUBLIC_API_URL=http://localhost:8000`
  and that CORS_ORIGINS includes `http://localhost:3000`.
- **uploads fail** — ensure the `minio-setup` container created the
  `creator-os-assets` bucket (`make logs` → "bucket ready").
- **401 in dashboard** — token expired or `.env` admin creds changed; log in again.
