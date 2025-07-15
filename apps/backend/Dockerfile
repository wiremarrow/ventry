# Production Dockerfile for Ventry Backend
# Multi-stage build for optimal size and security

# Stage 1: Dependencies
FROM node:20-alpine AS deps
LABEL stage=deps

# Install production dependencies
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy dependency files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/database/package.json ./packages/database/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN pnpm install --frozen-lockfile --prod

# Stage 2: Builder
FROM node:20-alpine AS builder
LABEL stage=builder

RUN apk add --no-cache libc6-compat
WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy all files
COPY . .

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=deps /app/packages/database/node_modules ./packages/database/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules

# Generate Prisma client
RUN cd packages/database && pnpm prisma generate

# Build the application
RUN pnpm turbo run build --filter=@ventry/backend

# Stage 3: Runner
FROM node:20-alpine AS runner
LABEL stage=runner

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=512"

# Copy necessary files from builder
COPY --from=builder --chown=nodejs:nodejs /app/apps/backend/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/apps/backend/package.json ./
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/packages/database/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nodejs:nodejs /app/packages/database/node_modules/.prisma ./node_modules/.prisma

# Create health check script
RUN echo '#!/bin/sh\nwget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1' > /app/healthcheck.sh && \
    chmod +x /app/healthcheck.sh

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD /app/healthcheck.sh

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/index.js"]