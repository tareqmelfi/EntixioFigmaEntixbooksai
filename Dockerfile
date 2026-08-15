# syntax=docker/dockerfile:1.6
# Multi-stage build for Entix Books frontend (Vite + React)

# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:22.6.0-bookworm-slim AS build
# Force rebuild - security + nginx fix 2026-08-03
WORKDIR /app
ARG CACHE_BUST=1
RUN echo "Cache bust: $CACHE_BUST"

# Puppeteer runs only in the builder. The final nginx image receives static,
# prerendered HTML and does not contain Node or Chromium.
RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium ca-certificates fonts-liberation \
  && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Install deps · cache layer for npm
COPY package*.json ./
RUN npm ci --no-audit --no-fund

COPY . .
# Vite bakes VITE_* vars at build time — Coolify passes build-time env as
# Docker build args, so declare + export it before the vite build runs.
ARG VITE_TURNSTILE_SITEKEY=""
ENV VITE_TURNSTILE_SITEKEY=$VITE_TURNSTILE_SITEKEY
RUN npm run build

# ── Serve stage ──────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS serve
# Copy Vite build output (default dist/)
COPY --from=build /app/dist /usr/share/nginx/html

# Custom nginx config · SPA fallback + immutable asset cache
RUN cat > /etc/nginx/conf.d/default.conf <<'NGINX'
server {
  listen 80;
  server_name _;
  root /usr/share/nginx/html;
  index index.html;
  absolute_redirect off;

  # Canonical host and HTTPS are fixed rather than derived from an untrusted Host
  # header or the container's internal HTTP scheme behind Cloudflare/Coolify.
  if ($host = "www.entix.io") {
    return 308 https://entix.io$request_uri;
  }
  if ($http_x_forwarded_proto = "http") {
    return 308 https://entix.io$request_uri;
  }

  # Neutral chooser and the exact localized manifest artifacts.
  location = / { try_files /index.html =404; }
  location = /sa/ar { try_files /sa/ar/index.html =404; }
  location = /sa/en { try_files /sa/en/index.html =404; }
  location = /us/ar { try_files /us/ar/index.html =404; }
  location = /us/en { try_files /us/en/index.html =404; }

  # Canonical localized URLs have no trailing slash. Relative redirects retain
  # the browser's external HTTPS origin even though Nginx receives proxy HTTP.
  location = /sa/ar/ { return 308 /sa/ar$is_args$args; }
  location = /sa/en/ { return 308 /sa/en$is_args$args; }
  location = /us/ar/ { return 308 /us/ar$is_args$args; }
  location = /us/en/ { return 308 /us/en$is_args$args; }

  # Any other market/locale path is outside the constrained manifest.
  location ~ ^/(?:sa|us)/(?:ar|en)(?:/|$) { return 404; }

  # Canonicalize established public documents to no trailing slash. With
  # absolute_redirect disabled these remain same-origin HTTPS at the edge.
  location ~ ^/(features|pricing|referrals|about|contact|blog|docs|help|videos|glossary|case-studies|changelog|roadmap|partners|careers|team|integration|privacy|terms|refund|sla|login|register|forgot-password|reset-password)/$ {
    return 308 /$1$is_args$args;
  }
  location ~ ^/(solutions/(?:small-business|accountants|enterprises|restaurants|ecommerce)|support/ios)/$ {
    return 308 /$1$is_args$args;
  }

  # Established public routes are real prerendered documents. Exact matching and
  # $uri/index.html prevent neutral-root shell substitution if an artifact is absent.
  location ~ ^/(?:features|pricing|referrals|about|contact|blog|docs|help|videos|glossary|case-studies|changelog|roadmap|partners|careers|team|integration|privacy|terms|refund|sla|login|register|forgot-password|reset-password)$ {
    try_files $uri/index.html =404;
  }
  location ~ ^/solutions/(?:small-business|accountants|enterprises|restaurants|ecommerce)$ {
    try_files $uri/index.html =404;
  }
  location = /support/ios { try_files $uri/index.html =404; }

  # Controlled application surfaces remain client-rendered.
  location ~ ^/(?:app|portal|print)(?:/|$) { try_files $uri /index.html; }

  # Unknown extensionless paths are honest 404s rather than SPA fake-200s.
  location / { try_files $uri =404; }

  # Serve .well-known as static files with correct content type
  # (Microsoft identity verification requires application/json)
  location /.well-known/ {
    try_files $uri =404;
    default_type application/json;
    add_header Cache-Control "no-cache, no-store, must-revalidate";
  }

  # Cache hashed assets aggressively
  location ~* \.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }

  # Service worker must always revalidate · a stale SW would pin old bundles
  # (exact match beats the regex block above)
  location = /sw.js {
    expires -1;
    add_header Cache-Control "no-cache, no-store, must-revalidate";
    add_header Pragma "no-cache";
  }

  # Every HTML document, including prerendered nested route files, must revalidate.
  location ~* \.html$ {
    add_header Cache-Control "no-cache, no-store, must-revalidate";
    add_header Pragma "no-cache";
  }
}
NGINX

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
