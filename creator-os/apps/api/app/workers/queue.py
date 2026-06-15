"""Redis/RQ worker scaffold.

For Alpha, generation and publishing jobs are processed inline with mock
providers so the workflow is observable without a running worker. This module
provides the queue plumbing that Sprint 4+ will use to move that work off the
request path.
"""
from __future__ import annotations

from redis import Redis
from rq import Queue

from app.core.config import settings

redis_conn = Redis.from_url(settings.redis_url)
default_queue = Queue("creator-os", connection=redis_conn)
