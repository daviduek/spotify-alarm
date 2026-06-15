"""Auth-related schemas."""
from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, EmailStr

from app.schemas.common import ORMModel


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserRead(ORMModel):
    id: UUID
    workspace_id: UUID
    email: str
    full_name: str | None = None
    role: str
    status: str
