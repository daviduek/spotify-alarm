"""Convenience entrypoint: `python scripts/seed.py` (run from apps/api or via Docker)."""
from app.seed.seed_alpha import run_seed

if __name__ == "__main__":
    print(run_seed())
