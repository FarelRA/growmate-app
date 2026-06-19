# GrowMate App

Smart urban farming platform with IoT device monitoring, AI gardening assistant, community hub, marketplace, and support workflows.

Built on **Nuxt 4** + **Vue 3** + **Convex** + **Tailwind CSS v4**, managed with **Bun**.

## Setup

```sh
bun install
```

Copy `.env.local` and configure your Convex deployment and API keys:

```sh
cp .env.local .env
```

## Development

```sh
bun run dev          # Nuxt dev server
bun run convex:dev   # Convex dev session (separate terminal)
```

## Quality

```sh
bun run check        # typecheck + lint + test + build
bun run typecheck    # nuxt typecheck
bun run lint         # oxlint + eslint
bun run format       # prettier
bun run test         # unit tests (vitest)
bun run test:watch   # unit tests (watch mode)
bun run test:ui      # unit tests (vitest UI)
bun run test:e2e     # e2e tests (playwright)
```

## Project Structure

```
app/          # Nuxt pages, components, composables, lib
convex/       # Convex backend (schema, auth, queries, mutations)
server/       # Nitro server routes (sitemap, image optimization)
public/       # Static assets (icons, favicon, robots.txt)
```

## Environment

| Variable | Required | Description |
|---|---|---|
| `NUXT_PUBLIC_CONVEX_URL` | Yes | Convex deployment URL |
| `OPENAI_API_KEY` | For AI | Gemini/OpenAI API key |
| `DEVICE_API_KEY` | For IoT | Device telemetry auth |

## Stack

- **Frontend:** Nuxt 4, Vue 3, Tailwind v4, PWA
- **Backend:** Convex (schema, auth, real-time queries)
- **AI:** Google Gemini via OpenAI-compatible API
- **Auth:** Convex Auth with password providers
- **Infra:** Bun, Nitro, sharp (image optimization)
