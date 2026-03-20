FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.31.0 --activate
WORKDIR /app

# Copy dependency files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/api/package.json packages/api/package.json
COPY packages/auth/package.json packages/auth/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/utils/package.json packages/utils/package.json
COPY packages/tsconfig/package.json packages/tsconfig/package.json

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/ packages/
COPY apps/web/ apps/web/

# Build
RUN pnpm --filter @matrix-food/web build

# --- Production ---
FROM node:20-alpine AS runner
RUN corepack enable && corepack prepare pnpm@10.31.0 --activate
WORKDIR /app

COPY --from=base /app ./

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["pnpm", "--filter", "@matrix-food/web", "start"]
