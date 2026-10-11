"use node";

/**
 * Shared seed image pipeline.
 *
 * Seed binaries live as files in `public/seed-images/<hash>/<size>w.webp`
 * (served by the app at `/seed-images/...`) — dataset modules reference
 * them by content hash only, never inline bytes. At seed time the bytes are
 * fetched over HTTP(S) and uploaded to the MinIO image bucket under
 * `<hash>/<size>w.webp`, matching the `<hash>` value stored as `imageUrl` in
 * DB rows and resolved by `buildImageUrl` in `shared/utils/images.ts`.
 *
 * Runtime FS reads are impossible here: these actions execute inside the
 * Convex backend (no repo mount), so HTTP fetch from the deployed app is the
 * transport. Configure via Convex env:
 *   `npx convex env set SEED_ASSET_BASE_URL https://growmate.bond`
 * (local dev: `http://localhost:3000` with `bun dev` running). Falls back to
 * the production origin when unset.
 *
 * Idempotency: objects that already exist (HeadObject) are never
 * re-uploaded, so re-running a seed only repairs missing keys — including
 * rows created by an earlier run whose upload was interrupted.
 */

import { uploadFile, ensureBucket, objectExists } from "../seedData/storage";

export const SEED_IMAGE_SIZES = ["50w", "200w", "400w", "800w", "1200w"] as const;
export type SeedImageSize = (typeof SEED_IMAGE_SIZES)[number];

/** Cap per fetched variant: largest seed file is ~150KB; 8MB is generous. */
const MAX_SEED_IMAGE_BYTES = 8 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 30_000;

function getEnv(): Record<string, string | undefined> {
  return (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process?.env ?? {};
}

export function resolveSeedAssetBaseUrl(
  env: Record<string, string | undefined> = getEnv(),
): string {
  const raw =
    env.SEED_ASSET_BASE_URL ?? env.NUXT_PUBLIC_APP_URL ?? env.APP_URL ?? "https://growmate.bond";
  return raw.replace(/\/+$/, "");
}

export function seedImageUrl(hash: string, size: SeedImageSize, baseUrl?: string): string {
  return `${baseUrl ?? resolveSeedAssetBaseUrl()}/seed-images/${hash}/${size}.webp`;
}

async function fetchSeedBytes(url: string): Promise<Buffer> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`[seed] asset fetch failed: ${url} -> HTTP ${res.status}`);
    }
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) {
      throw new Error(`[seed] asset is not an image: ${url} (content-type: ${contentType})`);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length === 0 || buffer.length > MAX_SEED_IMAGE_BYTES) {
      throw new Error(`[seed] asset has invalid size (${buffer.length}B): ${url}`);
    }
    if (buffer.subarray(0, 4).toString("ascii") !== "RIFF") {
      throw new Error(`[seed] asset is not a webp file: ${url}`);
    }
    return buffer;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`[seed] asset fetch timed out after ${FETCH_TIMEOUT_MS}ms: ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Ensure all 5 size variants for `hash` exist in `bucket`. Skips keys that
 * already exist. Returns the hash for direct use as the row `imageUrl`.
 */
export async function uploadSeedImageSet(bucket: string, hash: string): Promise<string> {
  await ensureBucket(bucket);
  const baseUrl = resolveSeedAssetBaseUrl();
  for (const size of SEED_IMAGE_SIZES) {
    const key = `${hash}/${size}.webp`;
    if (await objectExists(bucket, key)) continue;
    const buffer = await fetchSeedBytes(seedImageUrl(hash, size, baseUrl));
    await uploadFile(bucket, key, buffer, "image/webp");
  }
  return hash;
}
