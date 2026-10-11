# GrowMate

[![Docker Release](https://github.com/FarelRA/growmate-app/actions/workflows/docker-release.yml/badge.svg)](https://github.com/FarelRA/growmate-app/actions/workflows/docker-release.yml)
[![License](https://img.shields.io/badge/license-GPLv3-blue.svg)](LICENSE)

Smart urban farming platform — monitor IoT devices, get AI gardening advice, connect with the community, and manage your grow operations from a mobile-friendly PWA.

Built with **Nuxt 4**, **Vue 3**, **Convex**, **RustFS**, and **Tailwind CSS v4**. Managed with **Bun**.

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
- [Traffic & gateway](#traffic--gateway)
- [Environment Reference](#environment-reference)
- [Database](#database)
- [Stack](#stack)
- [Contributing](#contributing)
- [License](#license)

## Installation

### Prerequisites

- [Bun](https://bun.sh) >= 1.3
- [Node.js](https://nodejs.org) >= 20

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

At minimum, set a Convex deployment URL:

```ini
NUXT_PUBLIC_CONVEX_URL=https://convex.growmate.bond
```

## Development

Start the Nuxt dev server:

```sh
bun run dev
```

In a separate terminal, start a local Convex dev session:

```sh
bun run convex:dev
```

The app is available at `http://localhost:3000`.

## Project Structure

```
app/              # Nuxt app (file-based routing, auto-imported dirs)
  assets/         # Global CSS (Tailwind entry point)
  components/     # UI components (shell, chat, marketing, admin, charts)
  composables/    # Vue composables (dashboard, admin, marketplace, etc.)
  middleware/     # Global auth middleware (auth.global.ts)
  pages/          # Routes, incl. blog/, products/, stories/ subdirs
  plugins/        # Convex Vue client plugin
  utils/          # App helpers (auth, images, uploads, markdown, plant-presets)
  app.vue, error.vue
convex/           # Convex backend
  _generated/     # Auto-generated client types
  helpers/        # Reusable query/mutation helpers
  migrations/     # One-off data migrations
  seedData/       # Seed data for plants, products, blog, community
  schema.ts       # Database schema
  auth.ts, auth.config.ts, customPassword.ts, types.ts
  *.ts            # Feature modules (plants, devices, sensors, streams, blog, etc.)
server/           # Nitro server layer
  api/v1/         # REST endpoints (camera, sensors, upload)
  api/v2/         # REST + WebSocket endpoints (sensors, recordings, stream)
  routes/         # sitemap.xml route
  utils/          # Server utilities (Convex client, images, storage, video relay, …)
shared/           # Cross-context pure code (auto-imported app + server)
  utils/          # errors, glossary, images, seo, setup, streamUrl
tests/            # Tests (mirror source tree)
  app/            # Component, composable, and util tests
  convex/         # Backend helper and rule tests
  server/         # API route and utility tests
  e2e/            # Playwright E2E tests
  setup/          # Vitest setup
public/           # Static assets (icons, favicon)
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
| `bun run test:e2e` | Playwright E2E tests (see [E2E tests](#e2e-tests)) |
| `bun run convex:deploy` | Deploy Convex functions to production |
| `bun run convex:dev` | Start local Convex dev backend |
| `bun run convex:seed:all` | Seed everything via `convex run seed:comprehensive` (admin, catalog, users, devices, claims, products, community, blog, sensors, threads, support, engagement) |
| `bun run convex:seed:plants` etc. | Seed one dataset (`convex run seed:<admin|plants|users|devices|claims|products|community|blog|sensors|threads|support|engagement>`) |

### E2E tests

```sh
bun run test:e2e
```

The guard specs (auth redirects, public pages, login form) run with no
backend seed and pass on a fresh checkout. The device happy path
(login, claim device, dashboard) needs a live Convex backend with a seeded
user and an unclaimed device, so it only runs when credentials are set:

```sh
E2E_TEST_EMAIL=demo@growmate.bond E2E_TEST_PASSWORD=<pw> \
E2E_DEVICE_ID=<unclaimed-fleet-id> bun run test:e2e
```

Device IDs are no-dash fleet IDs (`IAET01` for pods, `IAFU01` for tech,
`IAFT01` for tech-addon). `E2E_DEVICE_ID` defaults to `IAET01`, matching the
claim form placeholder example, so set a real unclaimed fleet ID from your
seed when that default is already claimed. Never point E2E at production (the Playwright
webServer builds and serves a local copy on `E2E_PORT`, default 3000).

## Deployment

Self-hosted deployment uses four containers behind Traefik with automatic TLS:

| Service | Image | Domain | Port |
|---|---|---|---|
| Traefik | `traefik:v3.7.13` | - | 80/443 |
| Nuxt app | `ghcr.io/farelra/growmate-app` | `growmate.bond` | 3000 |
| Convex backend (API) | `ghcr.io/get-convex/convex-backend` | `convex.growmate.bond` | 3210 |
| Convex backend (Site) | `ghcr.io/get-convex/convex-backend` | `convex.growmate.bond` | 3211 |
| RustFS S3 | `rustfs/rustfs:1.0.1` | `storage.growmate.bond` | 9000 |

### Prerequisites

- Server with Docker Compose
- Domains pointing to the server
- GitHub repo with CI/CD configured
- [GitHub Container Registry](https://ghcr.io) token for pulling

### 1. Prepare the server

```sh
git clone https://github.com/FarelRA/growmate-app.git
cd growmate-app
```

Copy the example env and edit it:

```sh
cp .env.example .env
```

At minimum you need to set:

| Variable | How to get |
|---|---|
| `CONVEX_INSTANCE_SECRET` | `openssl rand -hex 32` |
| `RUSTFS_ACCESS_KEY` | Any random string (20+ chars) |
| `RUSTFS_SECRET_KEY` | Any random string (20+ chars) |
| `DEVICE_API_KEY` | Any random string — MUST equal the firmware build token (`APP_API_TOKEN`) |
| `OPENAI_API_KEY` | OpenAI API key |

### 2. Generate the Convex admin key

The admin key is derived from `INSTANCE_SECRET`. Two approaches:

**Option A — generate offline:**

```sh
docker pull ghcr.io/get-convex/convex-backend:latest
docker run --rm ghcr.io/get-convex/convex-backend:latest \
  generate_admin_key growmate <INSTANCE_SECRET>
```

Copy that value into `.env`:

```ini
CONVEX_SELF_HOSTED_ADMIN_KEY=<value>
```

**Option B — generate at first start:**

Leave `CONVEX_SELF_HOSTED_ADMIN_KEY` blank in `.env`, then start only Convex:

```sh
docker compose up -d rustfs convex
```

Watch the logs for the admin key:

```sh
docker compose logs convex 2>&1 | grep "Admin key"
```

Copy that value into `.env`:

```ini
CONVEX_SELF_HOSTED_ADMIN_KEY=growmate|<hex>
```

Then restart the stack:

```sh
docker compose up -d
```

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
curl -sI https://convex.growmate.bond   # → 200 (Convex)
curl -sI https://storage.growmate.bond  # → 200 (RustFS)
curl -sI https://growmate.bond          # → 200 (Nuxt)
```

#### Migrating an existing MinIO deployment

RustFS cannot read MinIO's on-disk format, so cut over to a fresh volume —
no `mc` steps are needed, the app self-provisions everything:

```sh
docker compose down
docker volume rm growmate-app_minio-data   # exact name: docker volume ls | grep minio
cp .env.example .env   # re-apply: MINIO_* keys are now RUSTFS_* (same values work)
docker compose up -d   # buckets (images public, recordings private) auto-create on first upload
npx convex run seed:comprehensive   # re-uploads seed images into the fresh buckets
```

Past `recordings` objects do not carry over (30-day TTL regenerates history);
seed images re-upload automatically since every hash is missing. After seeding,
confirm a catalog image loads, e.g. open any `https://storage.growmate.bond/images/<hash>/400w.webp`
URL shown in the plant library.

### 4. Deploy Convex functions

```sh
npx convex deploy
```

### 5. Set Convex user environment variables

Convex self-hosted **does not** pass Docker container env vars to the action
runtime (except `CONVEX_CLOUD_ORIGIN` and `CONVEX_SITE_ORIGIN`).
User-facing env vars must be set via the Convex CLI:

```sh
# Generate JWT signing key
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out /tmp/jwt-key.pem
# Generate Public JWKS for JWT verification
openssl rsa -in /tmp/jwt-key.pem -traditional | npx pem-jwk | jq -s '{"keys": .}' > /tmp/jwks-key.json

# Set JWT signing key
npx convex env set JWT_PRIVATE_KEY --from-file /tmp/jwt-key.pem
# Set Generate Public JWKS
npx convex env set JWKS --from-file /tmp/jwks-key.json

# Remove the temporary files
rm /tmp/jwt-key.pem /tmp/jwks-key.json

# Admin credentials
npx convex env set ADMIN_EMAIL "$ADMIN_EMAIL"
npx convex env set ADMIN_PASSWORD "$ADMIN_PASSWORD"

# Device fleet auth (same value as DEVICE_API_KEY in .env / firmware APP_API_TOKEN)
npx convex env set DEVICE_API_KEY "$DEVICE_API_KEY"

# S3 signing region for retention deletes (convex/crons.ts, default us-east-1)
npx convex env set S3_REGION "${S3_REGION:-us-east-1}"

# AI assistant (convex/openai.ts action runtime, same values as .env)
npx convex env set OPENAI_BASE_URL "$OPENAI_BASE_URL"
npx convex env set OPENAI_API_KEY "$OPENAI_API_KEY"
npx convex env set OPENAI_MODEL "$OPENAI_MODEL"

# RustFS access
npx convex env set RUSTFS_ENDPOINT "$RUSTFS_ENDPOINT"
npx convex env set RUSTFS_ACCESS_KEY "$RUSTFS_ACCESS_KEY"
npx convex env set RUSTFS_SECRET_KEY "$RUSTFS_SECRET_KEY"
npx convex env set RUSTFS_BUCKET_IMAGE "$RUSTFS_BUCKET_IMAGE"
```

### 6. Seed initial data

Seed image bytes live as files in `public/seed-images/<hash>/` (served by the
app at `/seed-images/...`) — dataset modules carry only content hashes. The
app must be reachable before image seeds run, and Convex needs its base URL:

```sh
npx convex env set SEED_ASSET_BASE_URL https://growmate.bond
# local dev (with `bun dev` running): npx convex env set SEED_ASSET_BASE_URL http://localhost:3000
```

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
docker compose pull && docker compose up -d
```

## Traffic & gateway

All public traffic enters through Traefik (TLS via Let's Encrypt) and fans out by host:

```
internet ── :443 ──▶ traefik ─┬─ growmate.bond ────────▶ growmate:3000 (Nuxt + Nitro)
                               ├─ api.growmate.bond ────▶ growmate:3000 (device fleet API)
                               ├─ convex.growmate.bond ─▶ convex:3210 (/api/*, /instance_name)
                               │                          └▶ convex:3211 (everything else)
                               └─ storage.growmate.bond ─▶ rustfs:9000 (S3)
```

The browser opens 3 connections: same-origin pages/API via Nitro, Convex queries/subscriptions direct to the Convex host, and images direct to the storage host. The browser bypasses Nitro for Convex data — deliberate (realtime subscriptions); auth is enforced inside Convex functions, not at the edge.

- Device fleet API (firmware contract, no firmware edits needed): `POST api.growmate.bond/v1/sensors` + `/v1/camera` (compiled firmware paths) and the `/api/v1/*` aliases serve the same handlers. Auth is `Authorization: Bearer <DEVICE_API_KEY>` — the key MUST equal the firmware build token (pods `APP_API_TOKEN`, tech `APP_API_TOKEN` env), mirrored via `npx convex env set DEVICE_API_KEY`. Fleet IDs are no-dash: pods `IAET01` to `IAET18`, tech `IAFU01` to `IAFU09`, tech-addon `IAFT01` to `IAFT14` (v1 rows carry no variant, v2 rows carry `tech` or `tech-addon`). Nitro `requireDeviceKey` fails closed (500 when unset) → Convex mutation re-checks `deviceKey` (`convex/sensors.ts`). Responses carry `{commands[] (always with id), config?, claim?, minFirmware?, firmwareUrl?}` under 3KB; telemetry dedups on `snapshotId`; commands redeliver until acked in `acceptedCommandIds`; pods pump/light are XOR-paced server-side. Tech live video: `POST /api/v1/video/live` (chunked MJPEG) → `GET /api/v1/video/live/:id` + `/api/v1/video/latest/:id.jpg` for viewers.
- Nitro reaches Convex over `CONVEX_INTERNAL_URL` (`http://convex:3210`), never the public hairpin (`server/utils/convex.ts`).
- Live video (tech MJPEG push): device `POST /api/v1/video/live` while streaming → viewers `GET /api/v1/video/live/:id` (multipart, plain `<img>`) or `GET /api/v1/video/latest/:id.jpg`, both `?token=` + ownership-checked. Completed sessions are stored as multipart `.mjpeg` recordings (private bucket + `videoRecordings` rows, 30d TTL, newest 20/device) and replay in history via `<img>`; legacy `.h264` rows keep the WebCodecs player. Users start/stop streams from the Stream tab (v2-only, validated params); recordings require `Bearer` plus ownership and are served as 1h presigned URLs from the private `recordings` bucket (signed against the public RustFS host, `server/utils/storage.ts`).
- Stream registration runs an SSRF guard (`isBlockedStreamHost`): loopback / link-local / RFC-1918 / service names rejected, Tailscale `100.64/10` intentionally allowed.
- Edge hardening (compose + Nuxt): `api-ratelimit` (100 avg / 200 burst) on the RustFS + Convex API routers, `www` → apex redirect, digest-pinned app + Convex images, healthchecks + `restart: unless-stopped`, tightened CSP (`connect-src` limited to self + Convex + storage hosts).

Secrets (`DEVICE_API_KEY`, `RUSTFS_SECRET_KEY`, `CONVEX_INTERNAL_URL`, …) live only in server/container env — the browser sees just `NUXT_PUBLIC_CONVEX_URL`, `NUXT_PUBLIC_RUSTFS_BASE_URL`, and the image bucket name.

## Environment Reference

**Docker Compose env vars** (set in `.env`, consumed by containers):

| Variable | Used by | Description |
|---|---|---|
| `CONVEX_CLOUD_ORIGIN` | Convex | Public URL of the Convex backend |
| `CONVEX_SITE_ORIGIN` | Convex | Same as above (for site URLs) |
| `CONVEX_SITE_URL` | Convex (`auth.config.ts` JWT issuer) | Same as above (wired into the Convex container; falls back to `SITE_URL`, then localhost) |
| `CONVEX_SELF_HOSTED_URL` | Convex CLI | Backend address for `npx convex deploy` / `env set` |
| `CONVEX_INSTANCE_NAME` | Convex | Backend instance name |
| `CONVEX_INSTANCE_SECRET` | Convex | Backend secret (hex, 32 bytes) |
| `CONVEX_SELF_HOSTED_ADMIN_KEY` | Convex CLI | Admin key for `npx convex deploy` |
| `CONVEX_INTERNAL_URL` | Nitro (`server/utils/convex.ts`) | In-cluster Convex API URL, hardcoded to `http://convex:3210` in compose |
| `CONVEX_TIMEOUT_MS` | Nitro (optional) | Convex client timeout in ms, default 8000 |
| `RUSTFS_ACCESS_KEY` | RustFS, Convex | S3 access key |
| `RUSTFS_SECRET_KEY` | RustFS, Convex | S3 secret key |
| `RUSTFS_BUCKET_IMAGE` | Nuxt, Convex | S3 bucket for plant images |
| `NUXT_PUBLIC_RUSTFS_BASE_URL` | Nuxt | Public RustFS URL |
| `NUXT_PUBLIC_CONVEX_URL` | Nuxt | Public Convex URL (for browser) |
| `DEVICE_API_KEY` | Nitro device routes + Convex ingest/stream mutations | IoT device auth |
| `OPENAI_BASE_URL` | Convex (AI assistant action) | OpenAI-compatible gateway endpoint |
| `OPENAI_API_KEY` | Convex (AI assistant action) | Gateway API key |
| `OPENAI_MODEL` | Convex (AI assistant action) | Model identifier |

**Convex user env vars** (set via `npx convex env set`, stored in Convex DB):

| Variable | Required for | How to set |
|---|---|---|
| `JWT_PRIVATE_KEY` | Auth (token signing) | `npx convex env set JWT_PRIVATE_KEY --from-file key.pem` |
| `JWKS` | Auth (token verification) | `npx convex env set JWKS '<json>'` |
| `ADMIN_EMAIL` | `seed:admin` | `npx convex env set ADMIN_EMAIL ...` |
| `ADMIN_PASSWORD` | `seed:admin` | `npx convex env set ADMIN_PASSWORD ...` |
| `DEVICE_API_KEY` | Device ingest/stream mutations | `npx convex env set DEVICE_API_KEY ...` (same value as firmware `APP_API_TOKEN`) |
| `RUSTFS_ENDPOINT` | Seed functions (S3 upload) | `npx convex env set RUSTFS_ENDPOINT ...` |
| `RUSTFS_ACCESS_KEY` | Seed functions | `npx convex env set RUSTFS_ACCESS_KEY ...` |
| `RUSTFS_SECRET_KEY` | Seed functions | `npx convex env set RUSTFS_SECRET_KEY ...` |
| `RUSTFS_BUCKET_IMAGE` | Seed functions | `npx convex env set RUSTFS_BUCKET_IMAGE ...` |
| `S3_REGION` | Retention deletes (`convex/crons.ts`) | `npx convex env set S3_REGION us-east-1` |
| `OPENAI_BASE_URL` | AI assistant (`convex/openai.ts`) | `npx convex env set OPENAI_BASE_URL ...` |
| `OPENAI_API_KEY` | AI assistant (`convex/openai.ts`) | `npx convex env set OPENAI_API_KEY ...` |
| `OPENAI_MODEL` | AI assistant (`convex/openai.ts`) | `npx convex env set OPENAI_MODEL ...` |
| `SEED_ASSET_BASE_URL` | Seed image fetch (`/seed-images`) | `npx convex env set SEED_ASSET_BASE_URL https://growmate.bond` (falls back to `NUXT_PUBLIC_APP_URL`, then `APP_URL`) |

**Nuxt runtime config** (used in browser and server):

| Config key | Env var | Default |
|---|---|---|
| `public.convexUrl` | `NUXT_PUBLIC_CONVEX_URL` | `VITE_CONVEX_URL` fallback |
| `public.imageBaseUrl` | `NUXT_PUBLIC_RUSTFS_BASE_URL` | `https://storage.growmate.bond` |
| `public.rustfsBucketImage` | `NUXT_PUBLIC_RUSTFS_BUCKET_IMAGE` | `images` |

## Database

The Convex backend manages 26 tables:

| Table | Purpose |
|---|---|
| `users` | Accounts with role, handle, profile |
| `plantCatalog` | Built-in plant presets (10 species) |
| `plants` | User's plants, linked to devices |
| `devices` | IoT devices with sensor config |
| `sensors` | Current sensor readings per plant |
| `sensorReadings` | Historical time-series data (90-day retention) |
| `deviceSnapshots` | Telemetry dedup rows by `snapshotId` (30-day retention) |
| `videoRecordings` | Tech live-session recording metadata (30-day retention, newest 20 per device) |
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
- **Backend:** Convex (schema, auth, real-time queries), RustFS (S3-compatible storage)
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

[GNU General Public License v3.0](LICENSE)
