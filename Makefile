# ============================================================
# CardioGuard AI — Unified Makefile
# ============================================================
# Usage: make <target>
# Run `make help` to see all available targets.
# ============================================================

.PHONY: help setup dev build test lint migrate seed deploy clean docker-up docker-down docker-build docker-logs

SHELL := /bin/bash
BACKEND_DIR := backend
FRONTEND_DIR := web_frontend
SCRIPTS_DIR := $(BACKEND_DIR)/scripts
MIGRATION_SCRIPT := $(SCRIPTS_DIR)/run_all_migrations.py
SEED_SCRIPT := $(SCRIPTS_DIR)/seed_data.py

# ── Help ─────────────────────────────────────────────────────
help: ## Show this help message
	@echo "CardioGuard AI — Available Commands:"
	@echo "======================================"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ── First-time Setup ─────────────────────────────────────────
setup: ## First-time project setup (venv, deps, env)
	@echo "=== Setting up CardioGuard AI ==="
	@if [ ! -d "$(BACKEND_DIR)/.venv" ]; then \
		echo "Creating Python virtual environment..."; \
		cd $(BACKEND_DIR) && python -m venv .venv; \
	fi
	@echo "Installing Python dependencies..."
	@. $(BACKEND_DIR)/.venv/bin/activate && pip install -r $(BACKEND_DIR)/requirements.txt
	@echo "Installing Node dependencies..."
	@cd $(FRONTEND_DIR) && npm ci
	@if [ ! -f .env ]; then \
		echo "Creating .env from .env.docker.example..."; \
		cp .env.docker.example .env; \
		echo ">> Please edit .env with your actual credentials!"; \
	fi
	@echo "=== Setup complete! ==="

# ── Local Development ────────────────────────────────────────
dev: ## Start local development with Docker Compose
	docker compose up --build

dev-detached: ## Start local development in background
	docker compose up --build -d
	@echo "Backend: http://localhost:8000"
	@echo "Frontend: http://localhost:5173"
	@echo "Logs: make docker-logs"

dev-backend: ## Start only backend locally (without Docker)
	cd $(BACKEND_DIR) && .venv/bin/python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

dev-frontend: ## Start only frontend locally (without Docker)
	cd $(FRONTEND_DIR) && npm run dev

# ── Build ────────────────────────────────────────────────────
build: docker-build ## Build all Docker images

docker-build: ## Build Docker images
	docker compose build

docker-build-no-cache: ## Build Docker images without cache
	docker compose build --no-cache

# ── Database ─────────────────────────────────────────────────
migrate: ## Run all database migrations on Supabase
	cd $(BACKEND_DIR) && python $(MIGRATION_SCRIPT)

migrate-force: ## Force re-apply all migrations (update checksums)
	cd $(BACKEND_DIR) && python $(MIGRATION_SCRIPT) --force

seed: ## Seed sample data into database
	cd $(BACKEND_DIR) && python $(SEED_SCRIPT)

db-reset: ## Reset database (WARNING: drops all data)
	@echo "WARNING: This will drop ALL data in the database!"
	@read -p "Are you sure? (y/N): " confirm && [ "$$confirm" = "y" ] || exit 1
	cd $(BACKEND_DIR) && python -c "\
	import asyncio; \
	from app.core.database import database, connect_db; \
	async def reset(): \
	    await connect_db(); \
	    tables = await database.fetch_all(\"SELECT tablename FROM pg_tables WHERE schemaname='public'\"); \
	    for t in tables: \
	        await database.execute(f'DROP TABLE IF EXISTS public.{t[0]} CASCADE'); \
	    await database.disconnect(); \
 asyncio.run(reset())"
	@echo "All tables dropped. Run 'make migrate' then 'make seed' to rebuild."

db-status: ## Check migration status
	@echo "=== Migration Files ==="
	@ls -1 $(BACKEND_DIR)/migrations/*.sql | head -20
	@echo ""
	@echo "=== To check applied migrations, run:"
	@echo "   cd $(BACKEND_DIR) && python -c \"import asyncio; from app.core.database import *; asyncio.run(connect_db()); import database; print(await database.fetch_all('SELECT filename, applied_at FROM schema_migrations ORDER BY filename'))\""

# ── Testing ──────────────────────────────────────────────────
test: ## Run all tests
	cd $(FRONTEND_DIR) && npm test
	@echo "Backend tests: cd $(BACKEND_DIR) && python -m pytest tests/ -v"

test-backend: ## Run backend tests only
	cd $(BACKEND_DIR) && python -m pytest tests/ -v

test-frontend: ## Run frontend tests only
	cd $(FRONTEND_DIR) && npm test

# ── Linting ──────────────────────────────────────────────────
lint: lint-frontend ## Run all linters

lint-frontend: ## Lint frontend code
	cd $(FRONTEND_DIR) && npm run lint

lint-backend: ## Lint backend code (if ruff/flake8 installed)
	cd $(BACKEND_DIR) && python -m ruff check app/ || echo "Install ruff: pip install ruff"

# ── Docker Management ────────────────────────────────────────
docker-up: ## Start Docker containers (background)
	docker compose up -d

docker-down: ## Stop Docker containers
	docker compose down

docker-logs: ## Tail logs from all containers
	docker compose logs -f

docker-logs-backend: ## Tail backend logs only
	docker compose logs -f backend

docker-logs-web: ## Tail frontend logs only
	docker compose logs -f web

docker-restart: ## Restart all containers
	docker compose restart

docker-rebuild: ## Rebuild and restart all containers
	docker compose down
	docker compose up --build -d

docker-ps: ## Show running containers
	docker compose ps

# ── Deployment ───────────────────────────────────────────────
deploy: ## Deploy to production (push to Git triggers auto-deploy)
	@echo "=== Deploying CardioGuard AI ==="
	@echo "Pushing to Git..."
	git add -A
	@read -p "Commit message: " msg; \
	git commit -m "$$msg"; \
	git push origin HEAD
	@echo "=== Deploy triggered! Render + Vercel will auto-deploy. ==="

deploy-force: ## Force deploy (skip checks, push immediately)
	git add -A && git commit -m "deploy: force deploy $(shell date +%Y%m%d-%H%M%S)" && git push origin HEAD

deploy-status: ## Check deployment status
	@echo "=== Git Status ==="
	@git status --short
	@echo ""
	@echo "=== Last 5 commits ==="
	@git log --oneline -5
	@echo ""
	@echo "=== Remote tracking ==="
	@git branch -vv | grep -E "\*|phuc-bang|main"

# ── Database Performance ─────────────────────────────────────
perf-test: ## Run quick DB performance test
	cd $(BACKEND_DIR) && python scripts/db_test_simple.py

perf-detail: ## Run detailed DB performance analysis
	cd $(BACKEND_DIR) && python scripts/db_test_detail.py

# ── Cleanup ──────────────────────────────────────────────────
clean: ## Clean generated files and caches
	@echo "Cleaning Python caches..."
	@find $(BACKEND_DIR) -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	@find $(BACKEND_DIR) -type f -name "*.pyc" -delete 2>/dev/null || true
	@echo "Cleaning Node caches..."
	@rm -rf $(FRONTEND_DIR)/node_modules/.cache
	@rm -rf $(FRONTEND_DIR)/dist
	@echo "Cleaning Docker..."
	@docker system prune -f 2>/dev/null || true
	@echo "Done."

clean-all: clean ## Deep clean (including node_modules and venv)
	@rm -rf $(BACKEND_DIR)/.venv
	@rm -rf $(FRONTEND_DIR)/node_modules
	@echo "All dependencies removed. Run 'make setup' to reinstall."

# ── Info ─────────────────────────────────────────────────────
info: ## Show project info
	@echo "CardioGuard AI"
	@echo "==============="
	@echo "Backend:    http://localhost:8000"
	@echo "Frontend:   http://localhost:5173"
	@echo "Health:     http://localhost:8000/health"
	@echo "Docs:       http://localhost:8000/docs"
	@echo ""
	@echo "Production URLs:"
	@echo "  Backend:  https://cardioguard-backend.onrender.com"
	@echo "  Frontend: https://cardioguard-dashboard.vercel.app"
	@echo "  Custom:   https://giatky.site"
	@echo ""
	@echo "Branches:"
	@git branch --show-current
	@echo ""
	@echo "Quick Start:"
	@echo "  make setup      # First-time setup"
	@echo "  make dev         # Start with Docker"
	@echo "  make migrate     # Run migrations"
	@echo "  make seed        # Seed sample data"
	@echo "  make deploy      # Deploy to production"
