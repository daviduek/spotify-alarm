"""Domain validation errors mapped to HTTP 422 at the route layer."""
from __future__ import annotations


class ValidationError(Exception):
    """Raised when a business rule (approval gate, etc.) is violated."""
