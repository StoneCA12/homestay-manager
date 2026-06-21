#!/bin/sh
set -e

echo "==> Running database migrations..."
alembic upgrade head

echo "==> Seeding demo data..."
python -m app.seed

echo "==> Starting API server..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
