#!/bin/bash
# ============================================================
# CardioGuard AI — Deployment Script
# ============================================================
# Usage: ./scripts/deploy.sh [branch] [options]
#   ./scripts/deploy.sh                    # Deploy current branch
#   ./scripts/deploy.sh main               # Deploy main branch
#   ./scripts/deploy.sh phuc-bang          # Deploy phuc-bang branch
#   ./scripts/deploy.sh --migrate-only     # Only run migrations
#   ./scripts/deploy.sh --dry-run          # Show what would be done
# ============================================================

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_ROOT/backend"

# Defaults
BRANCH=""
MIGRATE_ONLY=false
DRY_RUN=false
SKIP_TESTS=false
FORCE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --migrate-only) MIGRATE_ONLY=true; shift ;;
        --dry-run) DRY_RUN=true; shift ;;
        --skip-tests) SKIP_TESTS=true; shift ;;
        --force|-f) FORCE=true; shift ;;
        --help|-h)
            echo "Usage: $0 [branch] [options]"
            echo ""
            echo "Options:"
            echo "  --migrate-only   Only run database migrations"
            echo "  --dry-run        Show what would be done without executing"
            echo "  --skip-tests     Skip running tests before deploy"
            echo "  --force, -f      Force deploy without confirmation"
            echo "  --help, -h       Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                        # Deploy current branch"
            echo "  $0 main                   # Deploy main branch"
            echo "  $0 phuc-bang --dry-run    # Preview deployment"
            exit 0
            ;;
        *) BRANCH="$1"; shift ;;
    esac
done

log() { echo -e "${BLUE}[DEPLOY]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ── Pre-flight checks ──────────────────────────────────────
log "CardioGuard AI — Deployment Script"
echo "=================================="

if [ -z "$BRANCH" ]; then
    BRANCH=$(git -C "$PROJECT_ROOT" branch --show-current)
    log "Using current branch: $BRANCH"
else
    log "Target branch: $BRANCH"
fi

# Verify branch exists
if ! git -C "$PROJECT_ROOT" rev-parse --verify "$BRANCH" >/dev/null 2>&1; then
    error "Branch '$BRANCH' does not exist"
fi

# Check for uncommitted changes
if [ -n "$(git -C "$PROJECT_ROOT" status --porcelain)" ]; then
    warn "You have uncommitted changes!"
    if [ "$FORCE" = false ]; then
        read -p "Continue anyway? (y/N): " confirm
        [ "$confirm" = "y" ] || exit 1
    fi
fi

# Switch to branch if needed
CURRENT_BRANCH=$(git -C "$PROJECT_ROOT" branch --show-current)
if [ "$BRANCH" != "$CURRENT_BRANCH" ]; then
    log "Switching from '$CURRENT_BRANCH' to '$BRANCH'..."
    if [ "$DRY_RUN" = false ]; then
        git -C "$PROJECT_ROOT" checkout "$BRANCH"
    else
        log "[DRY-RUN] Would switch to branch: $BRANCH"
    fi
fi

# Pull latest
log "Pulling latest changes..."
if [ "$DRY_RUN" = false ]; then
    git -C "$PROJECT_ROOT" pull origin "$BRANCH"
else
    log "[DRY-RUN] Would pull from origin/$BRANCH"
fi

# ── Migrate Only ───────────────────────────────────────────
if [ "$MIGRATE_ONLY" = true ]; then
    log "Running database migrations only..."
    if [ "$DRY_RUN" = false ]; then
        cd "$BACKEND_DIR" && python scripts/run_all_migrations.py
    else
        log "[DRY-RUN] Would run: python scripts/run_all_migrations.py"
    fi
    success "Migrations complete!"
    exit 0
fi

# ── Run Tests ──────────────────────────────────────────────
if [ "$SKIP_TESTS" = false ]; then
    log "Running frontend lint..."
    if [ "$DRY_RUN" = false ]; then
        cd "$PROJECT_ROOT/web_frontend" && npm run lint 2>/dev/null || warn "Lint failed (non-blocking)"
    else
        log "[DRY-RUN] Would run: npm run lint"
    fi

    log "Running backend syntax check..."
    if [ "$DRY_RUN" = false ]; then
        cd "$BACKEND_DIR" && python -m compileall app/ -q 2>/dev/null || warn "Syntax check failed (non-blocking)"
    else
        log "[DRY-RUN] Would run: python -m compileall app/"
    fi
else
    warn "Tests skipped (--skip-tests)"
fi

# ── Build Docker Images ────────────────────────────────────
log "Building Docker images..."
if [ "$DRY_RUN" = false ]; then
    cd "$PROJECT_ROOT" && docker compose build
else
    log "[DRY-RUN] Would build: docker compose build"
fi

# ── Run Migrations ─────────────────────────────────────────
log "Running database migrations..."
if [ "$DRY_RUN" = false ]; then
    cd "$BACKEND_DIR" && python scripts/run_all_migrations.py
else
    log "[DRY-RUN] Would run migrations"
fi

# ── Commit & Push ──────────────────────────────────────────
if [ -n "$(git -C "$PROJECT_ROOT" status --porcelain)" ]; then
    log "Committing changes..."
    TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    if [ "$DRY_RUN" = false ]; then
        cd "$PROJECT_ROOT"
        git add -A
        git commit -m "deploy: auto-deploy $BRANCH $TIMESTAMP"
        git push origin "$BRANCH"
    else
        log "[DRY-RUN] Would commit and push to $BRANCH"
    fi
else
    log "No changes to commit"
fi

# ── Summary ─────────────────────────────────────────────────
echo ""
success "=== Deployment Complete ==="
echo ""
echo "Branch:  $BRANCH"
echo "Backend: https://cardioguard-backend.onrender.com"
echo "Frontend: https://cardioguard-dashboard.vercel.app"
echo ""
echo "Monitor logs:"
echo "  Render:  https://dashboard.render.com"
echo "  Vercel:  https://vercel.com/dashboard"
echo ""
