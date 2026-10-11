#!/bin/sh
# IndexNow ping on container start (SEO-02 · 2026-10-11): tells Bing (which also feeds
# ChatGPT search, Microsoft Copilot and DuckDuckGo), Yandex and Naver that the sitemap
# documents changed. Key file is served at https://entix.io/4b5ee57a94ce2eaec3c9974dcdb8cd4a.txt (public, not a secret).
# Runs after the Cloudflare purge delay so crawlers fetch fresh HTML.
( sleep 300
  URLS=$(curl -sS --max-time 20 https://entix.io/sitemap.xml | grep -o '<loc>[^<]*</loc>' | sed 's/<\/\?loc>//g' | head -200 | sed 's/.*/"&"/' | paste -sd, -)
  [ -n "$URLS" ] || { echo "[indexnow] no urls"; exit 0; }
  code=$(curl -sS -o /tmp/indexnow.json -w '%{http_code}' --max-time 20 -X POST https://api.indexnow.org/IndexNow \
    -H "Content-Type: application/json; charset=utf-8" \
    --data "{\"host\":\"entix.io\",\"key\":\"4b5ee57a94ce2eaec3c9974dcdb8cd4a\",\"keyLocation\":\"https://entix.io/4b5ee57a94ce2eaec3c9974dcdb8cd4a.txt\",\"urlList\":[$URLS]}")
  echo "[indexnow] HTTP $code $(head -c 160 /tmp/indexnow.json 2>/dev/null)"
) >/proc/1/fd/1 2>&1 &
exit 0
