# ─────────────────────────────────────────────────────────────
#  Kivo Backend — multi-stage production image
# ─────────────────────────────────────────────────────────────

# ── Stage 1: build ───────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies (with dev deps for the build)
COPY package*.json ./
RUN npm ci

# Compile TypeScript -> dist/
COPY tsconfig*.json ./
COPY src ./src
RUN npm run build

# Strip dev dependencies for a lean runtime node_modules
RUN npm prune --omit=dev

# ── Stage 2: runtime ─────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Run as an unprivileged user
RUN addgroup -g 1001 -S nodejs && adduser -S kivo -u 1001
USER kivo

COPY --chown=kivo:nodejs --from=builder /app/node_modules ./node_modules
COPY --chown=kivo:nodejs --from=builder /app/dist ./dist
COPY --chown=kivo:nodejs --from=builder /app/package.json ./package.json

EXPOSE 8080

# Lightweight healthcheck against the API health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||8080)+'/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "dist/server.js"]
