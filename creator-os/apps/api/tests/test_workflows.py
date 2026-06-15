"""Core workflow tests (PRD section 16 / schema section 15)."""
from __future__ import annotations

from fastapi.testclient import TestClient


def _sasha_id(client: TestClient, headers: dict) -> str:
    resp = client.get("/characters", headers=headers)
    assert resp.status_code == 200
    chars = resp.json()
    assert any(c["name"] == "Sasha Van" for c in chars), "Sasha must be seeded"
    return next(c["id"] for c in chars if c["name"] == "Sasha Van")


def test_health(client: TestClient) -> None:
    assert client.get("/health").json()["status"] == "ok"


def test_login_and_me(client: TestClient, auth_headers: dict) -> None:
    me = client.get("/auth/me", headers=auth_headers)
    assert me.status_code == 200
    assert me.json()["role"] == "admin"


def test_sasha_seeded(client: TestClient, auth_headers: dict) -> None:
    cid = _sasha_id(client, auth_headers)
    identity = client.get(f"/characters/{cid}/identity", headers=auth_headers)
    assert identity.status_code == 200
    pillars = client.get(f"/characters/{cid}/pillars", headers=auth_headers)
    assert len(pillars.json()) == 5
    templates = client.get("/prompt-templates", headers=auth_headers)
    assert len(templates.json()) >= 8


def test_create_idea(client: TestClient, auth_headers: dict) -> None:
    cid = _sasha_id(client, auth_headers)
    resp = client.post(
        "/ideas",
        headers=auth_headers,
        json={"character_id": cid, "title": "Airport luxury fit", "pillar_slug": "travel_luxury"},
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["title"] == "Airport luxury fit"


def test_generation_job_creates_asset(client: TestClient, auth_headers: dict) -> None:
    cid = _sasha_id(client, auth_headers)
    resp = client.post(
        "/generation-jobs",
        headers=auth_headers,
        json={"character_id": cid, "job_type": "text_to_image", "provider_type": "mock", "requested_output_count": 2},
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["status"] == "completed"
    assets = client.get(f"/assets?character_id={cid}", headers=auth_headers).json()
    assert len(assets) >= 2


def test_approve_asset_and_create_post(client: TestClient, auth_headers: dict) -> None:
    cid = _sasha_id(client, auth_headers)
    asset = client.post(
        "/assets",
        headers=auth_headers,
        json={"character_id": cid, "asset_type": "image", "title": "manual asset"},
    ).json()
    approved = client.post(f"/assets/{asset['id']}/approve", headers=auth_headers).json()
    assert approved["status"] == "approved"

    post = client.post(
        f"/assets/{asset['id']}/create-post",
        headers=auth_headers,
        json={"platform": "instagram"},
    )
    assert post.status_code == 201, post.text
    post_data = post.json()
    assert post_data["status"] == "post_draft"
    assert post_data["utm_source"] == "instagram"


def test_cannot_schedule_unapproved_post(client: TestClient, auth_headers: dict) -> None:
    cid = _sasha_id(client, auth_headers)
    post = client.post(
        "/posts",
        headers=auth_headers,
        json={"character_id": cid, "platform": "tiktok", "caption": "test"},
    ).json()
    resp = client.post(f"/posts/{post['id']}/schedule", headers=auth_headers, json={})
    assert resp.status_code == 422
    assert "approved" in resp.json()["detail"].lower()


def test_approve_post_requires_approved_assets(client: TestClient, auth_headers: dict) -> None:
    cid = _sasha_id(client, auth_headers)
    asset = client.post(
        "/assets", headers=auth_headers, json={"character_id": cid, "asset_type": "image"}
    ).json()
    post = client.post(
        f"/assets/{asset['id']}/create-post",
        headers=auth_headers,
        json={"platform": "instagram", "allow_draft_from_unapproved": True},
    ).json()
    # asset is not approved -> approving the post must fail
    resp = client.post(f"/posts/{post['id']}/approve", headers=auth_headers)
    assert resp.status_code == 422

    # approve asset, then post approval + schedule succeed
    client.post(f"/assets/{asset['id']}/approve", headers=auth_headers)
    approved = client.post(f"/posts/{post['id']}/approve", headers=auth_headers)
    assert approved.status_code == 200
    assert approved.json()["status"] == "post_approved"
    scheduled = client.post(
        f"/posts/{post['id']}/schedule",
        headers=auth_headers,
        json={"scheduled_at": "2026-06-20T18:00:00Z"},
    )
    assert scheduled.status_code == 200
    assert scheduled.json()["status"] == "scheduled"


def test_tracking_redirect_records_event(client: TestClient, auth_headers: dict) -> None:
    # 'sasha' tracking link is seeded
    resp = client.get("/go/sasha", follow_redirects=False)
    assert resp.status_code == 302
    events = client.get("/tracking-events", headers=auth_headers).json()
    assert len(events) >= 1
