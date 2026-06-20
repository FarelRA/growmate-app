# GrowMate

[![Docker Release](https://github.com/FarelRA/growmate-app/actions/workflows/docker-release.yml/badge.svg)](https://github.com/FarelRA/growmate-app/actions/workflows/docker-release.yml)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Smart urban farming platform — monitor IoT devices, get AI gardening advice, connect with the community, and manage your grow operations from a mobile-friendly PWA.

Built with **Nuxt 4**, **Vue 3**, **Convex** (self-hosted), and **Tailwind CSS v4**. Managed with **Bun**.

## Features

- **IoT device monitoring** — real-time sensor readings (soil moisture, light, temperature, humidity) with live charts
- **AI gardening assistant** — "Floral Assistant" powered by Google Gemini with full conversation history
- **Smart alerts & automation** — threshold-based notifications, care schedules, automated actuator commands
- **Plant catalog** — 10+ preset plants with sensor/lifecycle profiles; add custom plants
- **Community hub** — posts, comments, likes with activity points and leaderboard
- **Marketplace** — buy/sell plants and equipment with built-in chat
- **Admin panel** — manage users, devices, products, blog posts, and support tickets
- **PWA** — installable on mobile, works offline with service worker caching
- **Self-hosted** — full stack runs on your own infrastructure via Docker Compose

## Table of Contents

- [Installation](#installation)
- [Development](#development)
- [Project Structure](#project-structure)
- [Scripts](#scripts)
- [Deployment](#deployment)
- [Environment Reference](#environment-reference)
- [Database](#database)
- [Stack](#stack)
- [Contributing](#contributing)
- [License](#license)

## Installation

### Prerequisites

- [Bun](https://bun.sh) >= 1.3
- Node.js >= 20

### Setup

```sh
git clone https://github.com/FarelRA/growmate-app.git
cd growmate-app
bun install
```

Copy the example environment file and edit it:

```sh
cp .env.example .env
```

At minimum, set a Convex deployment URL (self-hosted or Convex cloud):

```ini
NUXT_PUBLIC_CONVEX_URL=https://convex.growmate.bond
```

## Development

Start the Nuxt dev server:

```sh
bun run dev
```

In a separate terminal, start a local Convex dev session (replaces your production backend for development):

```sh
bun run convex:dev
```

The app is available at `http://localhost:3000`.

## Project Structure

```
app/              # Nuxt application (pages, components, composables, lib)
  assets/         # Global CSS (Tailwind entry point)
  components/     # UI components (shell, chat, marketing, charts)
  composables/    # Vue composables (dashboard, admin, marketplace, etc.)
  lib/            # Utilities (auth, images, errors, SEO, markdown)
  pages/          # File-based routing (25+ pages)
  plugins/        # Convex Vue client plugin
  middleware/     # Global auth middleware
components/       # Page-specific components (admin, dashboard, marketplace panels)
convex/           # Convex backend
  _generated/     # Auto-generated client types
  helpers/        # Reusable query/mutation helpers
  seedData/       # Seed data for plants, products, blog
  schema.ts       # Database schema (23 tables)
  auth.ts         # Auth configuration
  *.ts            # Feature modules (plants, devices, sensors, blog, etc.)
server/           # Nitro server layer
  routes/api/v1/  # REST endpoints (camera, sensors, upload)
  utils/          # Server utilities (Convex client, images, storage, sitemap)
tests/            # Tests
  app/            # Component and lib tests
  convex/         # Helper and type tests
  server/         # API route and utility tests
  e2e/            # Playwright E2E tests
public/           # Static assets (icons, favicon)
stores/           # Pinia stores (reserved)
```

## Scripts

| Command | Description |
|---|---|
| `bun run dev` | Start Nuxt dev server |
| `bun run build` | Build for production |
| `bun run preview` | Preview production build |
| `bun run check` | Full CI pipeline: typecheck (Nuxt + Convex) → lint → test → build |
| `bun run typecheck` | Nuxt typecheck only |
| `bun run typecheck:convex` | Convex typecheck only |
| `bun run lint` | Run all linters (oxlint + eslint) |
| `bun run format` | Format with Prettier |
| `bun run test` | Run Vitest unit tests |
| `bun run test:watch` | Tests in watch mode |
| `bun run test:e2e` | Playwright E2E tests |
| `bun run convex:deploy` | Deploy Convex functions to production |
| `bun run convex:dev` | Start local Convex dev backend |
| `bun run convex:seed:all` | Seed all data (admin → plants → products → blog) |

## Deployment

Self-hosted deployment uses four containers behind Traefik with automatic TLS:

| Service | Image | Domain | Port |
|---|---|---|---|
| Traefik | `traefik:latest` | — | 80/443 |
| Nuxt app | `ghcr.io/farelra/growmate-app` | `growmate.bond` | 3000 |
| Convex backend | `ghcr.io/get-convex/convex-backend` | `convex.growmate.bond` | 3210 |
| MinIO S3 | `minio/minio:latest` | `storage.growmate.bond` | 9000 |

### Prerequisites

- Server with Docker Compose (or Podman)
- Domains pointing to the server (replace `*.growmate.bond` with yours)
- GitHub repo with CI/CD configured
- [GitHub Container Registry](https://ghcr.io) token for pulling

### 1. Prepare the server

```sh
mkdir -p /home/podman/services/data
git clone https://github.com/FarelRA/growmate-app.git /home/podman/services
```

Copy the example env and edit it:

```sh
cp .env.example .env
```

At minimum you need to set:

| Variable | How to get |
|---|---|
| `CONVEX_INSTANCE_SECRET` | `openssl rand -hex 32` |
| `MINIO_ACCESS_KEY` | Any random string (20+ chars) |
| `MINIO_SECRET_KEY` | Any random string (20+ chars) |
| `DEVICE_API_KEY` | Any random string |
| `OPENAI_API_KEY` | Google AI Studio |

### 2. Generate the Convex admin key

The admin key is derived from `INSTANCE_SECRET`. Two approaches:

**Option A — let Convex generate it (first start):**

Leave `CONVEX_SELF_HOSTED_ADMIN_KEY` blank in `.env`, then start only Convex:

```sh
docker compose up -d minio convex
```

Watch the logs for the admin key:

```sh
docker compose logs convex 2>&1 | grep "Admin key"
# → Admin key: growmate|<64-hex-chars>
```

Copy that value into `.env`:

```ini
CONVEX_SELF_HOSTED_ADMIN_KEY=growmate|<hex>
```

Then restart the stack:

```sh
docker compose up -d
```

**Option B — generate offline:**

```sh
docker pull ghcr.io/get-convex/convex-backend:latest
docker run --rm ghcr.io/get-convex/convex-backend:latest \
  generate_admin_key growmate <INSTANCE_SECRET>
```

Put the output in `CONVEX_SELF_HOSTED_ADMIN_KEY`.

### 3. Start the full stack

```sh
docker compose up -d
```

Verify all services are healthy:

```sh
docker compose ps
```

Test endpoints:

```sh
curl -sI https://convex.growmate.bond  # → 200
curl -sI https://storage.growmate.bond  # → 200 (MinIO)
curl -sI https://growmate.bond          # → 200 (Nuxt)
```

### 4. Deploy Convex functions

```sh
cd /home/podman/services
npx convex deploy
```

> `convex.json` is not committed — the CLI uses `CONVEX_SELF_HOSTED_URL` and
> `CONVEX_SELF_HOSTED_ADMIN_KEY` from `.env` to authenticate.

### 5. Set Convex user environment variables

Convex self-hosted **does not** pass Docker container env vars to the action
runtime (except `CONVEX_CLOUD_ORIGIN` and `CONVEX_SITE_ORIGIN`).
User-facing env vars must be set via the Convex CLI:

```sh
# JWT signing key (required by @convex-dev/auth)
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out /tmp/jwt-key.pem
npx convex env set JWT_PRIVATE_KEY --from-file /tmp/jwt-key.pem
rm /tmp/jwt-key.pem

# Admin credentials (for seed:admin)
npx convex env set ADMIN_EMAIL admin@growmate.bond
npx convex env set ADMIN_PASSWORD <your-password>

# MinIO access (for seed:plants, :products, :blog)
npx convex env set MINIO_ENDPOINT http://minio:9000
npx convex env set MINIO_ACCESS_KEY "$MINIO_ACCESS_KEY"
npx convex env set MINIO_SECRET_KEY "$MINIO_SECRET_KEY"
npx convex env set MINIO_BUCKET_IMAGE images
```

### 6. Seed initial data

```sh
npx convex run seed:admin
npx convex run seed:plants
npx convex run seed:products
npx convex run seed:blog
```

Or all at once:

```sh
bun run convex:seed:all
```

### 7. Configure CI/CD (optional)

Push to `main` triggers the workflow in `.github/workflows/docker-release.yml`:

1. Runs `bun run check` (typecheck → lint → test → build)
2. Builds multi-arch Docker image (`linux/amd64`, `linux/arm64`)
3. Pushes to `ghcr.io/farelra/growmate-app:latest`

On the server, set up a webhook or cron to pull and restart:

```sh
docker compose pull growmate && docker compose up -d growmate
```

## Environment Reference

**Docker Compose env vars** (set in `.env`, consumed by containers):

| Variable | Used by | Description |
|---|---|---|
| `CONVEX_CLOUD_ORIGIN` | Convex | Public URL of the Convex backend |
| `CONVEX_SITE_ORIGIN` | Convex | Same as above (for site URLs) |
| `CONVEX_INSTANCE_NAME` | Convex | Backend instance name |
| `CONVEX_INSTANCE_SECRET` | Convex | Backend secret (hex, 32 bytes) |
| `CONVEX_SELF_HOSTED_ADMIN_KEY` | Convex CLI | Admin key for `npx convex deploy` |
| `MINIO_ACCESS_KEY` | MinIO, Convex | S3 access key |
| `MINIO_SECRET_KEY` | MinIO, Convex | S3 secret key |
| `MINIO_BUCKET_IMAGE` | Nuxt, Convex | S3 bucket for plant images |
| `NUXT_PUBLIC_MINIO_BASE_URL` | Nuxt | Public MinIO URL |
| `NUXT_PUBLIC_CONVEX_URL` | Nuxt | Public Convex URL (for browser) |
| `DEVICE_API_KEY` | Nuxt | IoT device auth |
| `OPENAI_API_KEY` | Nuxt | Gemini/OpenAI API key |

**Convex user env vars** (set via `npx convex env set`, stored in Convex DB):

| Variable | Required for | How to set |
|---|---|---|
| `JWT_PRIVATE_KEY` | Auth (token signing) | `npx convex env set JWT_PRIVATE_KEY --from-file key.pem` |
| `ADMIN_EMAIL` | `seed:admin` | `npx convex env set ADMIN_EMAIL ...` |
| `ADMIN_PASSWORD` | `seed:admin` | `npx convex env set ADMIN_PASSWORD ...` |
| `MINIO_ENDPOINT` | Seed functions (S3 upload) | `npx convex env set MINIO_ENDPOINT http://minio:9000` |
| `MINIO_ACCESS_KEY` | Seed functions | `npx convex env set MINIO_ACCESS_KEY ...` |
| `MINIO_SECRET_KEY` | Seed functions | `npx convex env set MINIO_SECRET_KEY ...` |
| `MINIO_BUCKET_IMAGE` | Seed functions | `npx convex env set MINIO_BUCKET_IMAGE images` |

**Nuxt runtime config** (used in browser and server):

| Config key | Env var | Default |
|---|---|---|
| `public.convexUrl` | `NUXT_PUBLIC_CONVEX_URL` | `VITE_CONVEX_URL` fallback |
| `public.imageBaseUrl` | `NUXT_PUBLIC_MINIO_BASE_URL` | `https://storage.growmate.bond` |
| `public.minioBucketImage` | `NUXT_PUBLIC_MINIO_BUCKET_IMAGE` | `images` |
| `deviceApiKey` | `DEVICE_API_KEY` | — |

## Database

The Convex backend manages 23 tables:

| Table | Purpose |
|---|---|
| `users` | Accounts with role, handle, profile |
| `plantCatalog` | Built-in plant presets (10 species) |
| `plants` | User's plants, linked to devices |
| `devices` | IoT devices with sensor config |
| `sensors` | Current sensor readings per plant |
| `sensorReadings` | Historical time-series data (90-day retention) |
| `plantImages` | Camera / manual plant snapshots |
| `automationLogs` | Actuator command audit trail |
| `growEvents` | Full event log (plant, device, care) |
| `careSchedules` | Scheduled care tasks |
| `assistantThreads` | AI chat sessions |
| `assistantMessages` | AI chat messages |
| `supportRequests` | Support tickets |
| `supportMessages` | Support conversation messages |
| `products` | Marketplace product listings |
| `communityPosts` | Forum posts |
| `blogPosts` | Blog articles |
| `postComments` | Post comments |
| `postLikes` | Post likes |
| `marketplaceThreads` | Marketplace chat threads |
| `marketplaceMessages` | Marketplace chat messages |
| `notifications` | User notifications |
| `listingDrafts` | Saved product listing drafts |
| `userActivities` | Points-earning activity log |

Plus internal auth tables managed by `@convex-dev/auth`.

## Stack

- **Frontend:** Nuxt 4, Vue 3, Tailwind v4, PWA
- **Backend:** Convex (schema, auth, real-time queries)
- **AI:** Google Gemini via OpenAI-compatible API
- **Auth:** Convex Auth with password providers
- **Infra:** Bun, Nitro, sharp (image optimization)

## Contributing

Contributions are welcome. Please open an issue first to discuss what you'd
like to change.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Run `bun run check` to verify everything passes
4. Commit and push
5. Open a pull request

## License

MIT
