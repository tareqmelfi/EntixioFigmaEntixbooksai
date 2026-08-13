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

  # SPA fallback · all routes serve index.html
  location / {
    try_files $uri $uri/ /index.html;
  }

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
