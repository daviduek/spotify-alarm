COMPOSE = docker compose -f infra/docker-compose.yml

.PHONY: help dev up down logs migrate seed reset test api-shell ps

help:
	@echo "Creator OS Alpha — make targets"
	@echo "  make dev      Copy .env (if missing) and start the full stack"
	@echo "  make up       Start the stack (detached)"
	@echo "  make down     Stop the stack"
	@echo "  make logs     Tail all logs"
	@echo "  make migrate  Run Alembic migrations inside the api container"
	@echo "  make seed     Seed workspace, admin, and Sasha"
	@echo "  make reset    Tear down volumes and rebuild from scratch"
	@echo "  make test     Run backend tests inside the api container"

dev:
	@test -f .env || cp .env.example .env
	$(COMPOSE) up --build

up:
	@test -f .env || cp .env.example .env
	$(COMPOSE) up -d --build

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f

migrate:
	$(COMPOSE) exec api alembic upgrade head

seed:
	$(COMPOSE) exec api python -m app.seed.seed_alpha

reset:
	$(COMPOSE) down -v
	$(COMPOSE) up --build

test:
	$(COMPOSE) exec api pytest -q

api-shell:
	$(COMPOSE) exec api bash

ps:
	$(COMPOSE) ps
