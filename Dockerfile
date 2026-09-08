# ─────────────────────────────────────────────────────────
# Multi-stage Dockerfile — security hardened
# Stage 1: Build
# Stage 2: Production (minimal attack surface)
# ─────────────────────────────────────────────────────────

# Stage 1: Install dependencies
FROM node:20-alpine AS builder
WORKDIR /app

# Copy lockfile first for better layer caching
COPY package.json package-lock.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build 2>/dev/null || true

# ─────────────────────────────────────────────────────────
# Stage 2: Production image
# ─────────────────────────────────────────────────────────
FROM node:20-alpine AS production

# Security: run as non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

WORKDIR /app

# Copy only what's needed from build stage
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./

# Security hardening
USER nestjs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', r => process.exit(r.statusCode === 200 ? 0 : 1))"

EXPOSE 3000

CMD ["node", "dist/main.js"]
