from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import settings
from app.database import SessionLocal
from app.routers import auth, feedback, friends, posts, recipes, upload

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


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/health/ready")
def health_ready():
    """Readiness probe — proves the app can reach the database.

    The ALB target group points here so a task with broken DB egress
    fails its health check and ECS rolls back via the circuit breaker,
    instead of reporting 'green' over a silently-dead prod.
    """
    with SessionLocal() as session:
        session.execute(text("SELECT 1"))
    return {"status": "ready"}
