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

# NEXT_PUBLIC vars must be available at build time
ARG NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=duwic2wkd
ARG NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyAmkg7x7AJAdOpL9OwzEMv_PkCN6qezKAQ
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=matrix-food.firebaseapp.com
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID=matrix-food
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=matrix-food.firebasestorage.app
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=615234601159
ARG NEXT_PUBLIC_FIREBASE_APP_ID=1:615234601159:web:a96706612405ff78d63ee2
ARG NEXT_PUBLIC_APP_URL=https://matrixfood.com.br

ENV NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=$NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
ENV NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY
ENV NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ENV NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID
ENV NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ENV NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ENV NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

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
