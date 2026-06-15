"""Authentication routes."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession
from app.core.security import create_access_token, verify_password
from app.models import User
from app.schemas.auth import LoginRequest, TokenResponse, UserRead

router = APIRouter(tags=["auth"])


@router.post("/auth/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: DbSession) -> TokenResponse:
    user = db.scalars(select(User).where(User.email == payload.email)).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if user.status != "active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User disabled")

    user.last_login_at = datetime.now(timezone.utc)
    db.add(user)
    db.commit()
    token = create_access_token(str(user.id), {"workspace_id": str(user.workspace_id)})
    return TokenResponse(access_token=token)


@router.post("/auth/logout")
def logout(_: CurrentUser) -> dict:
    # Stateless JWT: client discards the token.
    return {"ok": True}


@router.get("/auth/me", response_model=UserRead)
def me(current_user: CurrentUser) -> User:
    return current_user
