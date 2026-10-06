import type { QueryCtx } from '../_generated/server'
import { getSupportMessages } from '../helpers/events'
import { formatTimestamp } from '../helpers/generic'
import { batchGetUsers } from './stats'

// AUTH POLICY: `requireAdmin` gates live ONLY in the thin delegates in
// ../admin.ts. Cores here perform pure DB logic.

// Support-ticket cores (moved verbatim from ../admin.ts).
export async function fetchAdminSupport(ctx: QueryCtx) {
  const supportRequests = await ctx.db.query('supportRequests').withIndex('by_createdAt').order('desc').take(30)
  const allUserIds = [
    ...supportRequests.map((r) => r.userId),
    ...supportRequests.map((r) => r.handledBy),
  ]
  const userMap = await batchGetUsers(ctx, allUserIds)

  return Promise.all(
    supportRequests.map(async (request) => {
      const owner = userMap.get(String(request.userId))
      const handledBy = request.handledBy ? userMap.get(String(request.handledBy)) : null
      const messages = await getSupportMessages(ctx, request._id, 24)
      return {
        ...request,
        userName: owner?.name ?? owner?.email ?? 'Pengguna tidak diketahui',
        userEmail: owner?.email ?? '',
        handledByName: handledBy?.name ?? null,
        createdAtLabel: formatTimestamp(request.createdAt),
        updatedAtLabel: formatTimestamp(request.updatedAt),
        messages: messages.map((message) => ({
          ...message,
          senderName:
            message.senderRole === 'admin'
              ? 'Admin'
              : message.senderRole === 'system'
                ? 'Sistem'
                : (owner?.name ?? owner?.email ?? 'Pengguna'),
          createdAtLabel: formatTimestamp(message.createdAt),
        })),
      }
    }),
  )
}

export async function fetchAdminSupportPaginated(
  ctx: QueryCtx,
  paginationOpts: { cursor: string | null; numItems: number },
) {
  return await ctx.db
    .query('supportRequests')
    .withIndex('by_createdAt')
    .order('desc')
    .paginate(paginationOpts)
}
