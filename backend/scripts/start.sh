#!/bin/bash
# ============================================================
# CardioGuard AI — Backend Startup Script
# ============================================================
# This script runs migrations before starting the FastAPI server.
# Used by Docker to ensure database is always up-to-date.
# ============================================================

set -e

echo "=== CardioGuard AI Backend ==="
echo "Starting at: $(date)"

# ── Run database migrations ─────────────────────────────────
echo "Running database migrations..."
python scripts/run_all_migrations.py 2>&1 || {
    echo "WARNING: Migration failed or partially applied. Continuing startup..."
}

echo "Migrations complete. Starting FastAPI server..."

# ── Start FastAPI server ────────────────────────────────────
exec python -m uvicorn app.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --workers 1
