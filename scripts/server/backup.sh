#!/usr/bin/env bash
# Run by mingldingl-backup.timer as the mingldingl user: a gzipped dump, fourteen kept.
set -euo pipefail
dir=/var/lib/mingldingl/backups
f="$dir/mingldingl-$(date +%Y%m%d-%H%M%S).sql.gz"
pg_dump --no-owner --no-acl -d mingldingl | gzip > "$f.part"
mv "$f.part" "$f"
echo "backup $f"
ls -1t "$dir"/mingldingl-*.sql.gz | tail -n +15 | xargs -r rm --
