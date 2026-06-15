#!/usr/bin/env bash
# Tear down volumes and rebuild the stack from scratch.
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose -f infra/docker-compose.yml down -v
docker compose -f infra/docker-compose.yml up --build
