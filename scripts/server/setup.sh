#!/usr/bin/env bash
# One-time (and safe to rerun) setup of the home server, as root: `scripts/deploy.sh --setup` runs it.
# No containers: the engine is a systemd service, the web pages are static files behind nginx, the
# database is the server's own Postgres, the nightly backup is a systemd timer.
#   --tunnel   also install cloudflared and enable the tunnel (TUNNEL_TOKEN must be in engine.env)
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo "run as root"; exit 1; }
cd "$(dirname "$0")"
DEPLOY_USER="${SUDO_USER:?run through sudo, so the deploying user is known}"

# The service user; the deploying user joins its group to read backups and engine.env.
id mingldingl >/dev/null 2>&1 || useradd --system --home-dir /var/lib/mingldingl --shell /usr/sbin/nologin mingldingl
usermod -aG mingldingl "$DEPLOY_USER"

install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" -m 755 /opt/mingldingl /opt/mingldingl/engine /opt/mingldingl/web
install -d -o mingldingl -g mingldingl -m 750 /var/lib/mingldingl /var/lib/mingldingl/keys /var/lib/mingldingl/backups
install -d -m 755 /etc/mingldingl /usr/local/lib/mingldingl
[[ -f /etc/mingldingl/engine.env ]] || install -o root -g mingldingl -m 640 engine.env.example /etc/mingldingl/engine.env
install -m 755 backup.sh /usr/local/lib/mingldingl/backup.sh

# The engine is self-contained; it needs only ICU from the system. nginx serves the web pages.
pkgs=(nginx)
ldconfig -p | grep -q libicuuc || pkgs+=("$(apt-cache search --names-only '^libicu[0-9]+$' | awk '{print $1}' | sort -V | tail -1)")
dpkg -s "${pkgs[@]}" >/dev/null 2>&1 || { apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "${pkgs[@]}"; }
rm -f /etc/nginx/sites-enabled/default
install -m 644 web.nginx.conf /etc/nginx/sites-available/mingldingl
ln -sf /etc/nginx/sites-available/mingldingl /etc/nginx/sites-enabled/mingldingl
nginx -t -q
systemctl enable --now nginx
systemctl reload nginx

# The database and its owner, reached over the socket by peer auth.
sudo -u postgres psql -qtAc "SELECT 1 FROM pg_roles WHERE rolname = 'mingldingl'" | grep -q 1 \
  || sudo -u postgres psql -qc "CREATE ROLE mingldingl LOGIN CREATEDB"
sudo -u postgres psql -qtAc "SELECT 1 FROM pg_database WHERE datname = 'mingldingl'" | grep -q 1 \
  || sudo -u postgres psql -qc "CREATE DATABASE mingldingl OWNER mingldingl"
sudo -u mingldingl psql -d mingldingl -qtAc "SELECT 1" >/dev/null

# Deploys restart the engine and run restore checks without a password; nothing else.
cat > /etc/sudoers.d/mingldingl <<EOF
$DEPLOY_USER ALL=(root) NOPASSWD: /usr/bin/systemctl restart mingldingl-engine, /usr/bin/systemctl restart mingldingl-tunnel
$DEPLOY_USER ALL=(mingldingl) NOPASSWD: ALL
EOF
chmod 440 /etc/sudoers.d/mingldingl
visudo -cqf /etc/sudoers.d/mingldingl

install -m 644 mingldingl-engine.service mingldingl-backup.service mingldingl-backup.timer mingldingl-tunnel.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable mingldingl-engine mingldingl-backup.timer
systemctl start mingldingl-backup.timer

if [[ "${1:-}" == "--tunnel" ]]; then
  grep -q '^TUNNEL_TOKEN=.' /etc/mingldingl/engine.env || { echo "TUNNEL_TOKEN is empty in /etc/mingldingl/engine.env"; exit 1; }
  if ! command -v cloudflared >/dev/null; then
    deb=$(mktemp --suffix .deb)
    curl -fsSL -o "$deb" https://github.com/cloudflare/cloudflared/releases/download/2025.9.1/cloudflared-linux-amd64.deb
    dpkg -i "$deb"; rm -f "$deb"
  fi
  systemctl enable --now mingldingl-tunnel
fi
echo "server ready"
