# Realtime (Socket.io) server. Built from the repo root so workspace packages resolve:
#   docker build -f apps/realtime/Dockerfile -t groundline-realtime .
FROM node:24-alpine AS base
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/realtime/package.json apps/realtime/
COPY packages/shared/package.json packages/shared/
RUN npm ci --omit=dev --workspace apps/realtime --include-workspace-root=false

COPY packages/shared packages/shared
COPY apps/realtime apps/realtime

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000
CMD ["node", "apps/realtime/src/index.ts"]
