# syntax=docker/dockerfile:1.6
# Multi-stage build for Entix Books frontend (Vite + React)

# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

# Install deps · cache layer for npm
COPY package*.json ./
RUN npm ci --no-audit --no-fund

# Build
COPY . .
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

  # Cache hashed assets aggressively
  location ~* \.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
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
