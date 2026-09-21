# Build context must be this directory (`docker compose` sets it to ./backend).
# On Render the default context is the repo root, so `COPY prisma` fails with
# "/prisma": not found. Use the root `Dockerfile` there, or set Root Directory
# to `backend`.
#
# Debian slim (not Alpine): Prisma's schema engine needs OpenSSL 3 shared libs.
FROM node:20-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV DATABASE_URL="file:./prisma/build.db"
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM node:20-bookworm-slim AS build
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV DATABASE_URL="file:./prisma/build.db"
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

FROM node:20-bookworm-slim
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV DATABASE_URL="file:/app/data/prod.db"
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./
EXPOSE 4000
CMD ["sh", "-c", "mkdir -p /app/data && npx prisma db push --skip-generate && node dist/server.js"]
