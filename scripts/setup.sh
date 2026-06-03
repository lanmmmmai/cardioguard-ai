#!/bin/bash
# ============================================================
# CardioGuard AI — First-Time Setup Script
# ============================================================
# Usage: ./scripts/setup.sh
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

log() { echo -e "${BLUE}[SETUP]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

echo "============================================================"
echo "  CardioGuard AI — First-Time Setup"
echo "============================================================"

# ── Check prerequisites ────────────────────────────────────
log "Checking prerequisites..."

if ! command -v python3 &>/dev/null && ! command -v python &>/dev/null; then
    error "Python 3 is not installed. Please install Python 3.11+"
fi

PYTHON_CMD="python3"
if ! command -v python3 &>/dev/null; then
    PYTHON_CMD="python"
fi

PYTHON_VERSION=$($PYTHON_CMD --version 2>&1 | awk '{print $2}')
log "Python: $PYTHON_VERSION"

if ! command -v node &>/dev/null; then
    error "Node.js is not installed. Please install Node.js 20+"
fi

NODE_VERSION=$(node --version)
log "Node.js: $NODE_VERSION"

if ! command -v docker &>/dev/null; then
    warn "Docker is not installed. You won't be able to run with Docker Compose."
fi

if ! command -v git &>/dev/null; then
    error "Git is not installed."
fi

# ── Create Python virtual environment ──────────────────────
BACKEND_DIR="$PROJECT_ROOT/backend"

if [ ! -d "$BACKEND_DIR/.venv" ]; then
    log "Creating Python virtual environment..."
    cd "$BACKEND_DIR" && $PYTHON_CMD -m venv .venv
    success "Virtual environment created at backend/.venv"
else
    warn "Virtual environment already exists, skipping..."
fi

# ── Install Python dependencies ────────────────────────────
log "Installing Python dependencies..."
source "$BACKEND_DIR/.venv/bin/activate" 2>/dev/null || true
pip install --upgrade pip -q
pip install -r "$BACKEND_DIR/requirements.txt" -q
success "Python dependencies installed"

# ── Install Node.js dependencies ───────────────────────────
log "Installing Node.js dependencies..."
cd "$PROJECT_ROOT/web_frontend" && npm ci
success "Node.js dependencies installed"

# ── Create .env file ───────────────────────────────────────
if [ ! -f "$PROJECT_ROOT/.env" ]; then
    log "Creating .env file from template..."
    cp "$PROJECT_ROOT/.env.docker.example" "$PROJECT_ROOT/.env"
    warn "Created .env file. Please edit it with your actual credentials!"
    echo ""
    echo "Required variables:"
    echo "  DATABASE_URL       - Supabase PostgreSQL connection string"
    echo "  SECRET_KEY         - JWT secret key (32+ characters)"
    echo "  OPENAI_API_KEY     - OpenAI API key (for chatbot)"
    echo "  BREVO_API_KEY      - Brevo API key (for email OTP)"
    echo ""
else
    warn ".env file already exists, skipping..."
fi

# ── Git hooks (optional) ───────────────────────────────────
log "Setting up Git hooks..."
if [ -d "$PROJECT_ROOT/.git" ]; then
    mkdir -p "$PROJECT_ROOT/.git/hooks"
    
    # Pre-commit hook: syntax check
    cat > "$PROJECT_ROOT/.git/hooks/pre-commit" << 'HOOKEOF'
#!/bin/bash
# CardioGuard AI — Pre-commit hook
echo "Running syntax checks..."

# Backend syntax check
if ! python -m compileall backend/app/ -q 2>/dev/null; then
    echo "ERROR: Backend syntax errors found! Fix before committing."
    exit 1
fi

echo "Syntax checks passed."
HOOKEOF
    chmod +x "$PROJECT_ROOT/.git/hooks/pre-commit"
    success "Git pre-commit hook installed"
else
    warn "Git repository not found, skipping hooks"
fi

# ── Summary ─────────────────────────────────────────────────
echo ""
echo "============================================================"
success "Setup complete!"
echo "============================================================"
echo ""
echo "Next steps:"
echo ""
echo "  1. Edit .env with your credentials:"
echo "     nano $PROJECT_ROOT/.env"
echo ""
echo "  2. Start development with Docker:"
echo "     cd $PROJECT_ROOT && make dev"
echo ""
echo "  3. Or run without Docker:"
echo "     make dev-backend    # Terminal 1"
echo "     make dev-frontend   # Terminal 2"
echo ""
echo "  4. Run database migrations:"
echo "     make migrate"
echo ""
echo "  5. Seed sample data:"
echo "     make seed"
echo ""
echo "  6. Deploy to production:"
echo "     make deploy"
echo ""
echo "Quick reference:"
echo "  make help             # Show all available commands"
echo "  make info             # Show project info"
echo ""
