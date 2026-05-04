# Multi-stage build for entix.io
# Stage 1: Vite build
FROM node:22-alpine AS builder

WORKDIR /app

# Install deps first (better cache)
COPY package*.json ./
RUN npm install --legacy-peer-deps --no-audit --no-fund

# Build
COPY . .
RUN npm run build

# Stage 2: nginx serve
FROM nginx:alpine

# SPA fallback config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
