FROM node:20-alpine AS base
RUN corepack enable

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json ./apps/server/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY . .
RUN pnpm --filter @novel/shared build
RUN pnpm --filter @novel/server build
RUN npx prisma generate --schema=apps/server/prisma/schema.prisma

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/server/dist ./dist
COPY --from=builder /app/apps/server/prisma ./prisma
COPY --from=builder /app/apps/server/node_modules ./node_modules
COPY --from=builder /app/node_modules/.pnpm ./node_modules/.pnpm
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
EXPOSE 4000
ENV PORT=4000
CMD ["node", "dist/index.js"]
