# ==============================================================================
# Production Dockerfile for PlanetU HRMS (Single-Container Full Stack)
# Serves: NestJS API (/api/v1/...) + React Production SPA (/)
# ==============================================================================

# Stage 1: Build Frontend and Backend
FROM node:22-alpine AS builder
WORKDIR /app

# Install system utilities needed for alpine builds
RUN apk add --no-cache openssl libc6-compat

# Copy dependency manifests
COPY package*.json ./
COPY prisma ./prisma/
COPY frontend/package*.json ./frontend/

# Install root & frontend dependencies
RUN npm ci
RUN npm --prefix frontend ci

# Copy full application source code
COPY tsconfig*.json ./
COPY nest-cli.json ./
COPY src ./src
COPY frontend ./frontend

# Generate Prisma client and compile production bundles
RUN npx prisma generate
RUN npm run build:backend
RUN npm run build:frontend

# Stage 2: Production Execution Image
FROM node:22-alpine AS runner
WORKDIR /app

RUN apk add --no-cache openssl libc6-compat

ENV NODE_ENV=production
ENV PORT=3000

# Copy runtime files from builder
COPY package*.json ./
COPY prisma ./prisma/
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/frontend/dist ./frontend/dist

EXPOSE 3000

# Push DB schema on start to guarantee cloud tables are synced, then boot server
CMD ["sh", "-c", "npx prisma db push && node dist/main"]
