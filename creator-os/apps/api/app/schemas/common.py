"""Shared Pydantic base classes."""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class ORMModel(BaseModel):
    """Base for read schemas mapped from SQLAlchemy ORM objects."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
