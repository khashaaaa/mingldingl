#!/usr/bin/env bash
# Nightly: pg_dump the local database, gzip it, upload it to Supabase Storage bucket "backups"; keep 7 days locally.
set -euo pipefail
ENGINE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CFG="$ENGINE_ROOT/src/MinglDingl.Engine/appsettings.Development.json"
BACKUP_DIR="$ENGINE_ROOT/backups"
DUMP="$BACKUP_DIR/mingldingl-$(date +%Y%m%d-%H%M%S).sql.gz"
mkdir -p "$BACKUP_DIR"
exec >> "$BACKUP_DIR/backup.log" 2>&1
echo "=== $(date -Iseconds) starting backup ==="
read_cfg() { python3 -c "import json,sys;d=json.load(open('$CFG'));print(eval('d'+sys.argv[1]))" "$1"; }
URL="$(read_cfg "['Supabase']['ProjectUrl']")"; KEY="$(read_cfg "['Supabase']['SecretKey']")"
CONN="$(read_cfg "['ConnectionStrings']['Default']")"
PGPASSWORD="$(printf '%s' "$CONN" | tr ';' '\n' | sed -n 's/^Password=//p')" pg_dump -U postgres -h 127.0.0.1 -d mingldingl | gzip > "$DUMP"
echo "dumped $(du -h "$DUMP" | cut -f1)"
code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 120 -X POST -H "Authorization: Bearer $KEY" -H "apikey: $KEY" \
  -H "Content-Type: application/gzip" --data-binary "@$DUMP" "${URL%/}/storage/v1/object/backups/$(basename "$DUMP")")
[[ "$code" -ge 200 && "$code" -lt 300 ]] && echo "uploaded (HTTP $code)" || echo "upload FAILED (HTTP $code)"
find "$BACKUP_DIR" -name 'mingldingl-*.sql.gz' -mtime +7 -delete
echo "=== done ==="
