from time import monotonic

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import settings
from app.database import SessionLocal
from app.routers import auth, feedback, friends, posts, recipes, upload, notifications

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(recipes.router)
app.include_router(upload.router)
app.include_router(feedback.router)
app.include_router(friends.router)
app.include_router(posts.router)
app.include_router(notifications.router)


@app.get("/health")
def health():
    return {"status": "ok"}


# How long a SUCCESSFUL database check is trusted before /health/ready queries again.
# 600s is chosen against Neon's autosuspend (~5 min idle): longer than the suspend
# threshold, so the compute is allowed to sleep between checks.
READY_DB_CACHE_SECONDS = 600
# Timestamp of the last successful DB check (monotonic seconds), or None if the last
# check FAILED or none has run. Process-local by design — each task proves its own
# egress, which is the whole point of the probe.
_last_ready_ok: float | None = None


@app.get("/health/ready")
def health_ready():
    """Readiness probe — proves this task can reach the database.

    The ALB target group points here so a task with broken DB egress fails its health
    check and ECS rolls back via the circuit breaker, instead of reporting 'green' over
    a silently-dead prod.

    THE CHECK IS MEMOIZED, and that is a cost fix, not a shortcut. The ALB polls this
    every 30s (infra/lib/issei-stack.ts) against a single always-on task, so querying on
    every call meant a database round-trip every 30 seconds forever. Neon's entire cost
    model is autosuspend-when-idle; a 30s heartbeat means it never gets an idle window,
    so the compute billed 24/7 (~730 compute-hours/month against a free tier of roughly
    190) on an app with almost no real traffic. That overage was health checks, not users.

    What the memoization deliberately preserves:
      - a NEW task always does a real query (nothing cached yet), so a deploy with broken
        DB egress still fails its first health check and still triggers the rollback —
        which is when this endpoint actually earns its keep;
      - a FAILED check is never cached, so once the DB is genuinely unreachable every
        subsequent poll re-probes at the full 30s cadence and the task goes unhealthy
        promptly;
      - only a SUCCESS is trusted, and only for READY_DB_CACHE_SECONDS.

    The cost: a DB that breaks while a task is already running is detected up to ~10
    minutes late rather than within 30 seconds. Accepted — the app 500s on real requests
    immediately either way, and paying for 24/7 compute to shorten that window is the
    wrong trade at this scale.
    """
    global _last_ready_ok
    now = monotonic()
    if _last_ready_ok is not None and (now - _last_ready_ok) < READY_DB_CACHE_SECONDS:
        return {"status": "ready", "db": "cached"}
    try:
        with SessionLocal() as session:
            session.execute(text("SELECT 1"))
    except Exception:
        # Clear the cache so the next poll re-probes instead of coasting on a stale OK.
        _last_ready_ok = None
        raise
    _last_ready_ok = now
    return {"status": "ready", "db": "checked"}
