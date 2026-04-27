#!/usr/bin/env bash
# Postgres backup → Cloudflare R2. AGENTS.md §23.4.
# Run via cron on the DB host. Requires `pg_dump`, `aws` (configured for R2 endpoint).
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must be set}"
: "${R2_BUCKET:?R2_BUCKET must be set}"
: "${R2_ENDPOINT:?R2_ENDPOINT must be set}"

ts="$(date -u +%Y%m%dT%H%M%SZ)"
out="/tmp/desain-pos-${ts}.dump"

echo "[backup] dumping database…"
pg_dump --format=custom --no-owner --no-privileges "$DATABASE_URL" > "$out"

echo "[backup] uploading to r2://${R2_BUCKET}/db/${ts}.dump"
aws s3 cp --endpoint-url "$R2_ENDPOINT" "$out" "s3://${R2_BUCKET}/db/${ts}.dump"

rm -f "$out"
echo "[backup] done"
