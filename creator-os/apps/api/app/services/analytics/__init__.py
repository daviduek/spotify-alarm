"""Analytics helpers (growth score, mock metrics)."""
from __future__ import annotations


def compute_growth_score(metrics: dict) -> float:
    """First-pass deterministic growth score (schema section 11.1)."""
    views = metrics.get("views", 0) or 0
    profile_visits = metrics.get("profile_visits", 0) or 0
    link_clicks = metrics.get("link_clicks", 0) or 0
    shares = metrics.get("shares", 0) or 0
    saves = metrics.get("saves", 0) or 0
    return (
        0.001 * views
        + 0.50 * profile_visits
        + 1.50 * link_clicks
        + 0.75 * shares
        + 0.50 * saves
    )
