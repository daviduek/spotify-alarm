"""RQ worker entrypoint: `python -m app.workers.worker`."""
from __future__ import annotations

from rq import Worker

from app.workers.queue import default_queue, redis_conn


def main() -> None:
    worker = Worker([default_queue], connection=redis_conn)
    worker.work(with_scheduler=True)


if __name__ == "__main__":
    main()
