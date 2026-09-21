# Render (and other hosts) use the repository root as the Docker build context.
# `backend/Dockerfile` expects context = backend/, which is why
# `COPY prisma` fails on Render with: "/prisma": not found.
#
# Prisma engines need OpenSSL 3, which Alpine's musl images often fail to load
# ("Error loading shared library..." parsed as JSON). Debian slim is reliable.
#
# Build: docker build -t spendscope .
# The image serves the API, WebSocket, and the built React app on one port.

FROM node:20-bookworm-slim AS frontend
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:20-bookworm-slim AS backend
WORKDIR /backend
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
# Prisma reads DATABASE_URL at generate time. Render does not inject
# dashboard env vars into `docker build` unless marked "available at build time".
ENV DATABASE_URL="file:./prisma/build.db"
COPY backend/package.json backend/package-lock.json ./
COPY backend/prisma ./prisma
RUN npm ci
COPY backend/ ./
RUN npx prisma generate && npm run build

FROM node:20-bookworm-slim
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV DATABASE_URL="file:/app/data/prod.db"
COPY --from=backend /backend/node_modules ./node_modules
COPY --from=backend /backend/dist ./dist
COPY --from=backend /backend/prisma ./prisma
COPY --from=backend /backend/package.json ./
COPY --from=frontend /frontend/dist ./public
EXPOSE 4000
CMD ["sh", "-c", "mkdir -p /app/data && npx prisma db push --skip-generate && node dist/server.js"]
