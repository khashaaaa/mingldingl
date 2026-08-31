#!/usr/bin/env bash
# Nightly risk-saver: dumps the local mingldingl Postgres DB and pushes the
# snapshot to the private "backups" bucket on Supabase. Local Postgres is the
# primary datastore now (Supabase direct-Postgres port 5432 is blocked from
# this network); Supabase keeps a rolling off-site copy in case local data is
# lost. Local dumps older than 7 days are pruned; remote retention is managed
# by re-running this script (it doesn't delete remote copies).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENGINE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
APPSETTINGS="$ENGINE_ROOT/src/MinglDingl.Engine/appsettings.Development.json"
BACKUP_DIR="$ENGINE_ROOT/backups"
LOG_FILE="$BACKUP_DIR/backup.log"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
DUMP_FILE="$BACKUP_DIR/mingldingl-$TIMESTAMP.sql.gz"

mkdir -p "$BACKUP_DIR"
exec >> "$LOG_FILE" 2>&1
echo "=== $(date -Iseconds) starting backup ==="

PROJECT_URL="$(jq -r '.Supabase.ProjectUrl' "$APPSETTINGS")"
SECRET_KEY="$(jq -r '.Supabase.SecretKey' "$APPSETTINGS")"

CONN_STR="$(jq -r '.ConnectionStrings.DefaultConnection' "$APPSETTINGS")"
PG_PASSWORD="$(printf '%s' "$CONN_STR" | tr ';' '\n' | sed -n 's/^Password=//p')"
PG_PASSWORD="${PG_PASSWORD:-${PGPASSWORD:-}}"
if [[ -z "$PG_PASSWORD" ]]; then
  echo "no Postgres password found in $APPSETTINGS or \$PGPASSWORD; aborting"
  exit 1
fi

PGPASSWORD="$PG_PASSWORD" pg_dump -U postgres -h 127.0.0.1 -p 5432 -d mingldingl | gzip > "$DUMP_FILE"
echo "dumped $(du -h "$DUMP_FILE" | cut -f1) to $DUMP_FILE"

http_code=$(curl -sS -o /tmp/backup-upload-response.json -w "%{http_code}" --max-time 60 \
  -X POST \
  -H "Authorization: Bearer $SECRET_KEY" \
  -H "apikey: $SECRET_KEY" \
  -H "Content-Type: application/gzip" \
  --data-binary "@$DUMP_FILE" \
  "$PROJECT_URL/storage/v1/object/backups/$(basename "$DUMP_FILE")")

if [[ "$http_code" -ge 200 && "$http_code" -lt 300 ]]; then
  echo "uploaded to Supabase backups bucket (HTTP $http_code)"
else
  echo "upload FAILED (HTTP $http_code): $(cat /tmp/backup-upload-response.json)"
fi

find "$BACKUP_DIR" -name 'mingldingl-*.sql.gz' -mtime +7 -delete
echo "=== $(date -Iseconds) done ==="
