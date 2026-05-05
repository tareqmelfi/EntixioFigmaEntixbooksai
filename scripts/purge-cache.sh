#!/usr/bin/env bash
# Cloudflare cache purge for entix.io zone
# Used by GitHub Action post-deploy + manual override
#
# Usage:
#   CF_ZONE_ID=xxx CF_API_TOKEN=xxx ./scripts/purge-cache.sh
#   ./scripts/purge-cache.sh --files "https://entix.io/index.html"   # selective
#
# Exits non-zero on failure (so CI fails fast).

set -euo pipefail

: "${CF_ZONE_ID:?CF_ZONE_ID env var is required}"
: "${CF_API_TOKEN:?CF_API_TOKEN env var is required}"

CF_API="https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/purge_cache"

# Default: purge everything. Override with --files for surgical purges.
PAYLOAD='{"purge_everything":true}'
if [ "${1:-}" = "--files" ] && [ -n "${2:-}" ]; then
  # Convert space-separated URLs into JSON array
  IFS=' ' read -r -a URLS <<< "$2"
  JSON_ARR=$(printf '"%s",' "${URLS[@]}")
  PAYLOAD="{\"files\":[${JSON_ARR%,}]}"
  echo "Selective purge: ${#URLS[@]} URLs"
else
  echo "Full purge for zone ${CF_ZONE_ID}"
fi

RESPONSE=$(curl -sS -X POST "$CF_API" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data "$PAYLOAD")

SUCCESS=$(echo "$RESPONSE" | grep -o '"success":true' || true)

if [ -z "$SUCCESS" ]; then
  echo "❌ Purge failed:"
  echo "$RESPONSE"
  exit 1
fi

echo "✅ Cache purged successfully at $(date -u +%H:%M:%SZ)"
