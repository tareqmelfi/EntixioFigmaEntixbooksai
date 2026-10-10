#!/bin/sh
# Purge the Cloudflare edge cache when a new FE container starts (PERF-03 · 2026-10-10).
# Public HTML is edge-cached by a Cloudflare Cache Rule; every deploy ships new hashed
# bundles, so stale HTML must be evicted. nginx:alpine runs every /docker-entrypoint.d/*.sh
# before starting nginx. Runs again after 90 s and 240 s to cover Coolify's traffic switch
# (the first purge can happen before the proxy points at this container).
# Requires runtime env CF_ZONE_ID + CF_PURGE_TOKEN (token scope: Zone · Cache Purge · entix.io).
# Without them it is a no-op (stale HTML then self-heals via the @stale-bundle fallback).
if [ -z "$CF_ZONE_ID" ] || [ -z "$CF_PURGE_TOKEN" ]; then
  echo "[cf-purge] CF_ZONE_ID/CF_PURGE_TOKEN not set — skipping edge purge"
  exit 0
fi
purge() {
  code=$(curl -sS -o /tmp/cf-purge.json -w '%{http_code}' --max-time 20 -X POST \
    "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/purge_cache" \
    -H "Authorization: Bearer $CF_PURGE_TOKEN" -H "Content-Type: application/json" \
    --data '{"purge_everything":true}' 2>&1)
  echo "[cf-purge] $1 → HTTP $code $(head -c 160 /tmp/cf-purge.json 2>/dev/null)"
}
purge "container start"
( sleep 90; purge "+90s"; sleep 150; purge "+240s" ) >/proc/1/fd/1 2>&1 &
exit 0
