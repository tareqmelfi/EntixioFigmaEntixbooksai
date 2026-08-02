# syntax=docker/dockerfile:1.6
# Multi-stage build for Entix Books frontend (Vite + React)

# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS build
# Force rebuild - security + nginx fix 2026-08-03
WORKDIR /app
ARG CACHE_BUST=1
RUN echo "Cache bust: $CACHE_BUST" 

# Install deps · cache layer for npm
COPY package*.json ./
RUN npm ci --no-audit --no-fund

# Build (vite only — skip puppeteer prerender to avoid Docker chromium issues)
COPY . .
RUN npm run build:vite-only

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

  # index.html must never cache
  location = /index.html {
    add_header Cache-Control "no-cache, no-store, must-revalidate";
    add_header Pragma "no-cache";
  }
}
NGINX

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
