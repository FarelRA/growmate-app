# GrowMate App

GrowMate is a Bun-based Nuxt app for smart urban farming. It combines a grow dashboard, AI gardening assistant, community hub, marketplace, and support workflows on top of a Convex backend.

## Stack

- Nuxt 4
- Vue 3
- Tailwind CSS v4
- Convex
- Bun

## Development

```sh
bun install
bun run dev
```

## Convex

Backend code lives in `convex/`.

Start a Convex dev session with:

```sh
bun run convex:dev
```

Set `NUXT_PUBLIC_CONVEX_URL` for the Nuxt app. `VITE_CONVEX_URL` is still accepted as a fallback for local transition, but `NUXT_PUBLIC_CONVEX_URL` is the intended runtime variable.

## Quality Checks

```sh
bun run type-check
bun run lint
bun run build-only
```

Run the full local verification suite with:

```sh
bun run check
```
