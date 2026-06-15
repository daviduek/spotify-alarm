#!/usr/bin/env bash
set -euo pipefail

echo "[entrypoint] waiting for database…"
python - <<'PY'
import time
import sqlalchemy
from app.core.config import settings

for attempt in range(30):
    try:
        engine = sqlalchemy.create_engine(settings.database_url)
        with engine.connect() as conn:
            conn.execute(sqlalchemy.text("SELECT 1"))
        print("[entrypoint] database is ready")
        break
    except Exception as exc:  # noqa: BLE001
        print(f"[entrypoint] db not ready ({attempt+1}/30): {exc}")
        time.sleep(2)
else:
    raise SystemExit("database never became ready")
PY

echo "[entrypoint] running migrations…"
alembic upgrade head

echo "[entrypoint] seeding data…"
python -m app.seed.seed_alpha

echo "[entrypoint] starting API…"
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
