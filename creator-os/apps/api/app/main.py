"""Creator OS Alpha - FastAPI application entrypoint."""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import (
    assets,
    auth,
    campaigns,
    characters,
    dashboard,
    generation_jobs,
    ideas,
    posts,
    prompt_templates,
    tracking,
)
from app.core.config import settings

app = FastAPI(
    title="Creator OS Alpha - Sasha Edition",
    version="0.1.0",
    description="Internal operating system for managing AI-assisted virtual creators.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["system"])
def health() -> dict:
    return {"status": "ok", "env": settings.app_env}


# API routers
app.include_router(auth.router)
app.include_router(characters.router)
app.include_router(campaigns.router)
app.include_router(ideas.router)
app.include_router(prompt_templates.router)
app.include_router(generation_jobs.router)
app.include_router(assets.router)
app.include_router(posts.router)
app.include_router(tracking.router)
app.include_router(dashboard.router)
