FROM node:lts-alpine AS builder

WORKDIR /app

COPY package.json bun.lock ./
RUN npm install -g bun && bun install --frozen-lockfile

COPY . .
RUN bun run build

FROM node:lts-alpine

WORKDIR /app

COPY --from=builder /app/.output .output

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
