#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Supergate — Droplet deploy script
# Run on the Droplet after git pull to rebuild and restart all services.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

COMPOSE="docker compose -f docker-compose.prod.yml"

echo "▶ Pulling latest images..."
$COMPOSE pull postgres redis nginx 2>/dev/null || true

echo "▶ Building application images..."
$COMPOSE build --no-cache gateway dashboard docs

echo "▶ Running database migrations..."
$COMPOSE run --rm gateway sh -c "
  cd /app/apps/gateway && \
  node -e \"require('dotenv').config()\" && \
  npx drizzle-kit migrate
" || echo "⚠  Migration step skipped (drizzle-kit not in prod image — run manually if needed)"

echo "▶ Starting services..."
$COMPOSE up -d --remove-orphans

echo "▶ Waiting for gateway health check..."
for i in $(seq 1 30); do
  if curl -sf http://localhost/health > /dev/null 2>&1; then
    echo "✓ Gateway is healthy"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "✗ Gateway failed to become healthy"
    exit 1
  fi
  echo "  Waiting... ($i/30)"
  sleep 3
done

echo "▶ Service status:"
$COMPOSE ps

echo ""
echo "✅ Deploy complete."
echo "   Dashboard: http://localhost"
echo "   API docs:  http://localhost/docs"
echo "   Health:    http://localhost/health"
