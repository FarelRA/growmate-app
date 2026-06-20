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

### Environment reference

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

## Stack

- **Frontend:** Nuxt 4, Vue 3, Tailwind v4, PWA
- **Backend:** Convex (schema, auth, real-time queries)
- **AI:** Google Gemini via OpenAI-compatible API
- **Auth:** Convex Auth with password providers
- **Infra:** Bun, Nitro, sharp (image optimization)
