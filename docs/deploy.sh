#!/bin/bash
# BBD Evolution — VPS Quick Deploy Script
# Run on a fresh Ubuntu 22.04+ VPS as a user with sudo access.
#
# Usage:
#   curl -sL <raw-url-to-this-script> | bash
#   — or —
#   chmod +x deploy.sh && ./deploy.sh

set -euo pipefail

REPO_URL="https://github.com/antikriza/BBD-evolution-code-clone.git"
INSTALL_DIR="/opt/bbd-bot"
DOMAIN="tg.bigbeautydata.com"

echo "=== BBD Evolution VPS Deploy ==="
echo ""

# ── 1. System packages ──────────────────────────
echo "[1/6] Updating system..."
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl

# ── 2. Docker ────────────────────────────────────
if ! command -v docker &> /dev/null; then
    echo "[2/6] Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker "$USER"
    sudo systemctl enable docker
    echo "  Docker installed. You may need to re-login for group changes."
else
    echo "[2/6] Docker already installed — skipping."
fi

# ── 3. Clone repo ───────────────────────────────
if [ ! -d "$INSTALL_DIR" ]; then
    echo "[3/6] Cloning repository..."
    sudo mkdir -p "$INSTALL_DIR"
    sudo chown "$USER:$USER" "$INSTALL_DIR"
    git clone "$REPO_URL" "$INSTALL_DIR"
else
    echo "[3/6] Directory exists — pulling latest..."
    cd "$INSTALL_DIR"
    git pull
fi

cd "$INSTALL_DIR"

# ── 4. Environment file ─────────────────────────
if [ ! -f .env ]; then
    echo "[4/6] Creating .env file..."
    echo ""
    read -rp "  Enter your Telegram BOT_TOKEN: " BOT_TOKEN
    cat > .env << EOF
BOT_TOKEN=$BOT_TOKEN
COURSE_BASE_URL=https://antikriza.github.io/BBD-evolution-code-clone/telegram-archive/course
EOF
    echo "  .env created."
else
    echo "[4/6] .env already exists — skipping."
fi

# ── 5. Build & start containers ─────────────────
echo "[5/6] Building and starting Docker containers..."
docker compose up -d --build
echo "  Containers started."
docker compose ps

# ── 6. Caddy (HTTPS reverse proxy) ──────────────
if ! command -v caddy &> /dev/null; then
    echo "[6/6] Installing Caddy..."
    sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
    sudo apt update
    sudo apt install -y caddy
else
    echo "[6/6] Caddy already installed — skipping install."
fi

echo "  Configuring Caddy for $DOMAIN..."
sudo tee /etc/caddy/Caddyfile > /dev/null << EOF
$DOMAIN {
    reverse_proxy localhost:8888
}
EOF

sudo systemctl restart caddy
sudo systemctl enable caddy

# ── Done ─────────────────────────────────────────
echo ""
echo "=== Deploy complete ==="
echo ""
echo "  Course site : https://$DOMAIN"
echo "  Bot logs    : docker compose -f $INSTALL_DIR/docker-compose.yml logs -f bot"
echo "  Web logs    : docker compose -f $INSTALL_DIR/docker-compose.yml logs -f web"
echo ""
echo "  Make sure DNS A record for $DOMAIN points to this server's IP."
echo ""
