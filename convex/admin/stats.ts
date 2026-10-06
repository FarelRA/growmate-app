import type { Doc, Id } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import { formatTimestamp } from '../helpers/generic'

// AUTH POLICY (applies to every module in convex/admin/): `requireAdmin`
// gates live ONLY in the thin delegates in ../admin.ts — auth stays at the
// API boundary. Cores in this directory perform pure DB logic and never call
// requireAdmin themselves.

// Shared batch loaders (moved verbatim from ../admin.ts).
export async function batchGetUsers(
  ctx: QueryCtx,
  ids: (Id<'users'> | undefined | null)[],
): Promise<Map<string, Doc<'users'> | null>> {
  const uniqueIds = [...new Set(ids.filter((id): id is Id<'users'> => id != null).map(String))]
  const userDocs = await Promise.all(uniqueIds.map((id) => ctx.db.get(id as Id<'users'>)))
  const map = new Map<string, Doc<'users'> | null>()
  uniqueIds.forEach((id, i) => map.set(id, userDocs[i] ?? null))
  return map
}

export async function batchGetPlants(
  ctx: QueryCtx,
  ids: (Id<'plants'> | undefined | null)[],
): Promise<Map<string, Doc<'plants'> | null>> {
  const uniqueIds = [...new Set(ids.filter((id): id is Id<'plants'> => id != null).map(String))]
  const plantDocs = await Promise.all(uniqueIds.map((id) => ctx.db.get(id as Id<'plants'>)))
  const map = new Map<string, Doc<'plants'> | null>()
  uniqueIds.forEach((id, i) => map.set(id, plantDocs[i] ?? null))
  return map
}

export type CountableTable =
  | 'users'
  | 'devices'
  | 'plants'
  | 'communityPosts'
  | 'products'
  | 'blogPosts'
  | 'supportRequests'

export async function countAllPaginated<TableName extends CountableTable>(
  ctx: QueryCtx,
  table: TableName,
  filter?: (doc: Doc<TableName>) => boolean,
) {
  let total = 0
  let cursor: string | null = null
  while (true) {
    const page = await ctx.db.query(table).paginate({ cursor, numItems: 500 })
    if (filter) {
      for (const doc of page.page) {
        if (filter(doc)) total += 1
      }
    } else {
      total += page.page.length
    }
    if (page.isDone) break
    cursor = page.continueCursor
  }
  return total
}

export async function fetchAdminStats(ctx: QueryCtx) {
  const [
    totalUsers,
    totalDevices,
    claimedDevices,
    totalPlants,
    activePlants,
    communityPosts,
    totalProducts,
    communityListings,
    officialProducts,
    blogPosts,
    totalTickets,
    openTickets,
  ] = await Promise.all([
    countAllPaginated(ctx, 'users'),
    countAllPaginated(ctx, 'devices'),
    countAllPaginated(ctx, 'devices', (d: Doc<'devices'>) => Boolean(d.userId)),
    countAllPaginated(ctx, 'plants'),
    countAllPaginated(ctx, 'plants', (p: Doc<'plants'>) => !p.archived),
    countAllPaginated(ctx, 'communityPosts'),
    countAllPaginated(ctx, 'products'),
    countAllPaginated(ctx, 'products', (p: Doc<'products'>) => p.type === 'community'),
    countAllPaginated(
      ctx,
      'products',
      (p: Doc<'products'>) => p.type === 'official' && p.status === 'active',
    ),
    countAllPaginated(ctx, 'blogPosts'),
    countAllPaginated(ctx, 'supportRequests'),
    countAllPaginated(ctx, 'supportRequests', (r: Doc<'supportRequests'>) => {
      return r.status === 'open' || r.status === 'in_progress'
    }),
  ])
  void totalPlants
  void totalProducts
  void totalTickets

  return {
    totalUsers,
    totalDevices,
    claimedDevices,
    activePlants,
    openTickets,
    officialProducts,
    communityListings,
    communityPosts,
    blogPosts,
  }
}

export async function fetchAdminRecentEvents(ctx: QueryCtx) {
  const recentEvents = await ctx.db.query('growEvents').withIndex('by_timestamp').order('desc').take(10)

  return recentEvents.map((event) => ({
    ...event,
    timestampLabel: formatTimestamp(event.timestamp),
  }))
}
