#!/usr/bin/env bash
# Proves the newest backup on the home server restores: loads it into a throwaway database next to
# the live one, counts accounts and bonds, and drops it. Never touches the live database.
set -euo pipefail
ssh server "sudo -n -u mingldingl bash -s" <<'EOF'
set -e
f=$(ls -1t /var/lib/mingldingl/backups/mingldingl-*.sql.gz 2>/dev/null | head -1)
[ -n "$f" ] || { echo "no backup yet"; exit 1; }
psql -d postgres -qc "DROP DATABASE IF EXISTS restore_check" -c "CREATE DATABASE restore_check"
gunzip -c "$f" | psql -q -d restore_check >/dev/null
echo "restored $f"
psql -d restore_check -Atc "SELECT count(*) || ' accounts, ' || (SELECT count(*) FROM bonds) || ' bonds' FROM accounts"
psql -d postgres -qc "DROP DATABASE restore_check"
EOF
