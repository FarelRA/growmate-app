# GrowMate App

GrowMate is a Bun-based Vue 3 web app for smart urban farming. It combines a plant operations dashboard, AI gardening assistant, community hub, marketplace, and B2B ESG reporting surface.

## Stack

- Vue 3 + Vite
- Tailwind CSS v4
- Convex backend functions and schema
- Bun for package management and scripts

## Features

- IoT-inspired dashboard with six sensor surfaces
- Floral Assistant chat experience with subscription tiers and support escalation
- Marketplace for official GrowMate kits and community harvest trading
- Community feed, leaderboard, badges, and referrals
- ESG metrics dashboard for sustainability reporting

## Run

```sh
bun install
bun dev
```

## Convex Setup

The frontend is wired for Convex and the backend source lives in `convex/`.

To connect it to a real deployment:

```sh
bun run convex:dev
```

On first run, Convex may ask you to choose or create a deployment interactively. After that, it will generate the local environment settings for `VITE_CONVEX_URL`.

The app auto-runs the `seed` mutation on mount so the demo data appears in a fresh deployment.

## Quality Checks

```sh
bun run type-check
bun run lint
bun run build
```

Or run everything:

```sh
bun run check
```
