FROM --platform=$BUILDPLATFORM node:24-alpine AS builder

WORKDIR /app

COPY package.json bun.lock bunfig.toml ./
# Pinned to bun major 1 to match bun.lock lockfileVersion 1 (local bun 1.4.2).
RUN npm install -g bun@1 && bun install --frozen-lockfile

COPY . .
RUN bun run build

FROM node:24-alpine

WORKDIR /app

COPY --from=builder /app/.output .output

USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget -qO- http://localhost:3000/ > /dev/null || exit 1

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
