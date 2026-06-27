#!/usr/bin/env bash
# Restore Postgres from a backup file
# Usage: ./scripts/restore.sh backups/homestay_YYYYMMDD_HHMMSS.sql
set -euo pipefail

FILE="${1:-}"
if [ -z "$FILE" ]; then
  echo "Usage: $0 <backup-file.sql>"
  echo ""
  echo "Available backups:"
  ls -t "$(cd "$(dirname "$0")/.." && pwd)/backups"/homestay_*.sql 2>/dev/null | head -10 || echo "  (none)"
  exit 1
fi

if [ ! -f "$FILE" ]; then
  echo "ERROR: File not found: $FILE" >&2
  exit 1
fi

CONTAINER=$(docker compose ps -q db 2>/dev/null | head -1)
if [ -z "$CONTAINER" ]; then
  echo "ERROR: db container not running. Start with: docker compose up -d db" >&2
  exit 1
fi

echo "Restoring from $FILE ..."
echo "WARNING: This will REPLACE all data in the database. Ctrl-C within 5s to abort."
sleep 5

docker exec -i "$CONTAINER" psql -U "${POSTGRES_USER:-homestay}" -d "${POSTGRES_DB:-homestay_db}" < "$FILE"
echo "Restore complete."
