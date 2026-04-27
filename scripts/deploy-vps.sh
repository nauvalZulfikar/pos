#!/usr/bin/env bash
# Deploy DESAIN POS to 72.60.196.21 — pos.aureonforge.com
# Run from /root/projects/pos on the VPS.
set -euo pipefail

PROJECT_DIR="/root/projects/pos"
cd "$PROJECT_DIR"

# 1) Ensure Node 22 (engines requires >=22)
if ! command -v node22 >/dev/null 2>&1; then
  if [ ! -d "$HOME/.nvm" ]; then
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
  fi
  export NVM_DIR="$HOME/.nvm"
  # shellcheck disable=SC1091
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
  nvm install 22
  nvm use 22
  ln -sf "$(nvm which 22)" /usr/local/bin/node22
fi

export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 22 >/dev/null

# 2) Spin up postgres + redis in dedicated POS containers
# Avoid port collisions with jobflow (5432/6379) etc — use 25435/26381
docker compose -f infra/docker/docker-compose.prod.yml up -d
sleep 5

# 3) Install workspace deps
pnpm install --frozen-lockfile=false

# 4) Run migrations + seed (idempotent)
pnpm --filter @desain/db migrate
pnpm --filter @desain/db rls:apply || true
pnpm --filter @desain/db seed || true

# 5) Build admin + pos (api/worker run via tsx, no build)
pnpm --filter @desain/admin build
pnpm --filter @desain/pos build

# 6) (Re)start services via pm2
if ! command -v pm2 >/dev/null 2>&1; then
  npm install -g pm2
fi

pm2 start ecosystem.config.cjs --update-env || pm2 reload ecosystem.config.cjs --update-env
pm2 save
echo "Deploy complete."
