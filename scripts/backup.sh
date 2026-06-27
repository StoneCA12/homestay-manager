#!/usr/bin/env bash
# Dump Postgres to a timestamped file under ./backups/
# Usage: ./scripts/backup.sh
set -euo pipefail

BACKUP_DIR="$(cd "$(dirname "$0")/.." && pwd)/backups"
mkdir -p "$BACKUP_DIR"

DATE=$(date +%Y%m%d_%H%M%S)
FILE="$BACKUP_DIR/homestay_${DATE}.sql"

# Detect running container name
CONTAINER=$(docker compose ps -q db 2>/dev/null | head -1)
if [ -z "$CONTAINER" ]; then
  echo "ERROR: db container not running. Start with: docker compose up -d db" >&2
  exit 1
fi

echo "Backing up to $FILE ..."
docker exec "$CONTAINER" pg_dump -U "${POSTGRES_USER:-homestay}" "${POSTGRES_DB:-homestay_db}" > "$FILE"

echo "Done: $FILE ($(du -h "$FILE" | cut -f1))"

# Keep only the 30 most recent backups
ls -t "$BACKUP_DIR"/homestay_*.sql 2>/dev/null | tail -n +31 | xargs -r rm --
echo "Retention: kept last 30 backups."
