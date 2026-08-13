# syntax=docker/dockerfile:1.7

# Base pinned by digest for reproducibility. This is the multi-arch manifest-list
# (index) digest for python:3.13-slim — verified to contain a linux/arm64/v8
# variant — so `--platform linux/arm64` selects the Graviton build from the pin.
#
# To refresh to a newer python:3.13-slim (verify it still has linux/arm64):
#   docker buildx imagetools inspect python:3.13-slim --format '{{.Manifest.Digest}}'
# or, without Docker, query the registry manifest API for the index digest.
FROM --platform=linux/arm64 python:3.13-slim@sha256:ffb752e139c0a19692a43af8d8523b274222dd68eebad5d583b45c2201c6e30a AS runtime

# - no .pyc written into the layer, unbuffered stdout so ECS/CloudWatch sees
#   logs immediately, no pip version chatter, no cache dir left behind.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# --- dependency layer (cached until requirements change) -------------------
# Copied and installed BEFORE app code so edits to app/ don't invalidate the
# pip layer. Every runtime dep in this list ships prebuilt arm64 wheels
# (psycopg2-binary, cryptography, cffi, bcrypt), so no compiler toolchain is
# needed in the image.
COPY requirements-prod.txt .
RUN pip install -r requirements-prod.txt

# --- application layer -----------------------------------------------------
# Only what the running service and migrations need. alembic/ + alembic.ini are
# included so the SAME image can run `alembic upgrade head` as a one-off task.
COPY app/ ./app/
COPY alembic/ ./alembic/
COPY alembic.ini ./alembic.ini

# --- non-root -------------------------------------------------------------
# Create an unprivileged user and own the tree. The app writes nothing to disk
# except Starlette's multipart upload spool (>1MB multiparts), which goes to the
# OS temp dir on the container's writable layer — fine, ephemeral, no volume.
RUN useradd --system --create-home --uid 10001 appuser \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# Belt-and-suspenders: the ALB target group health check on /health is the
# authoritative signal in ECS. This container-level check uses stdlib only (no
# curl in slim) and helps local/`docker run` and ECS container health.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health',timeout=2).status==200 else 1)"

# Single uvicorn process per task; scale with ECS task count behind the ALB.
# The ~21 sync handlers run on Starlette's threadpool (default 40 threads); the
# one async handler (/recipes/parse) shares the event loop. No --reload in prod.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
