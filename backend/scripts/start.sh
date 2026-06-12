#!/bin/bash
# ============================================================
# CardioGuard AI — Backend Startup Script
# ============================================================
# This script runs migrations before starting the FastAPI server.
# Used by Docker to ensure database is always up-to-date.
#
# Environment variables:
#   SKIP_MIGRATIONS_ON_ERROR=true  — allow startup even if migration fails
#                                    (dev/staging only; never set in production)
# ============================================================

set -e

echo "=== CardioGuard AI Backend ==="
echo "Starting at: $(date)"

# ── Run database migrations ─────────────────────────────────
echo "Running database migrations..."
if python scripts/run_all_migrations.py; then
    echo "Migrations complete. Starting FastAPI server..."
else
    EXIT_CODE=$?
    if [ "${SKIP_MIGRATIONS_ON_ERROR:-false}" = "true" ]; then
        echo "WARNING: Migration failed (exit $EXIT_CODE) but SKIP_MIGRATIONS_ON_ERROR=true — continuing startup."
    else
        echo "ERROR: Migration failed (exit $EXIT_CODE). Backend startup stopped."
        echo "       Set SKIP_MIGRATIONS_ON_ERROR=true to bypass (dev only)."
        exit $EXIT_CODE
    fi
fi

# ── Start FastAPI server ────────────────────────────────────
exec python -m uvicorn app.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --workers 1
