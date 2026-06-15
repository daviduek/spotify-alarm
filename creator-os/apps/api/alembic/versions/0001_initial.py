"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-06-15

Creates the full Creator OS Alpha schema. Tables are generated from the
SQLAlchemy metadata to guarantee the migration stays in sync with the models.
Enum-style workflow states are stored as indexed VARCHAR columns (permitted by
the schema spec) to keep Alpha migrations simple and reversible.
"""
from __future__ import annotations

from alembic import op

from app.models import Base

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")
    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)
