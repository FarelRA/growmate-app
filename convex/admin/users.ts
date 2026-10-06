import { ConvexError } from 'convex/values'
import type { Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'

// AUTH POLICY: `requireAdmin` gates live ONLY in the thin delegates in
// ../admin.ts. Cores here perform pure DB logic. The delegate passes the
// already-authorized admin's id where the core needs it as data
// (self-demotion guard).

// User core: cursor-paginated, mapped to the admin account-row shape so the
// dashboard `data.users` array keeps its fields after the legacy array query
// is gone.
export async function fetchAdminUsersPaginated(
  ctx: QueryCtx,
  paginationOpts: { cursor: string | null; numItems: number },
) {
  const result = await ctx.db.query('users').paginate(paginationOpts)
  return {
    ...result,
    page: result.page.map((user) => ({
      _id: user._id,
      name: user.name ?? user.email ?? 'Pengguna tanpa nama',
      email: user.email ?? '',
      handle: user.handle ?? '',
      tier: user.tier ?? 'basic',
      role: user.role ?? 'grower',
      setupComplete: Boolean(user.setupComplete),
    })),
  }
}

export async function updateUserAccess(
  ctx: MutationCtx,
  adminId: Id<'users'>,
  args: { userId: Id<'users'>; tier?: 'basic' | 'advanced'; role?: 'grower' | 'company' | 'admin' },
) {
  const target = await ctx.db.get(args.userId)
  if (!target) {
    throw new ConvexError('Pengguna tidak ditemukan')
  }

  if (String(target._id) === String(adminId) && args.role && args.role !== 'admin') {
    throw new ConvexError('Admin tidak dapat menghapus peran admin miliknya sendiri dari halaman ini')
  }

  await ctx.db.patch(args.userId, {
    tier: args.tier ?? target.tier,
    role: args.role ?? target.role,
    updatedAt: Date.now(),
  })

  return { success: true }
}
