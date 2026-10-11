import { v, ConvexError } from 'convex/values'
import { query, mutation, internalMutation } from './_generated/server'
import type { Id } from './_generated/dataModel'
import type { Ctx, MutationCtx, SensorKind } from './types'
import { getCurrentUser, requireUser } from './helpers/auth'
import { getSelectedDevice, buildDeviceSummary } from './helpers/devices'
import { getSupportMessages } from './helpers/events'
import { buildPlantView } from './helpers/plants'
import {
  normalizePlantSensorProfile,
  getSensorStatus,
  getSensorRange,
} from './helpers/sensors'
import { formatTimestamp } from './helpers/generic'
import {
  toggleScheduleCore,
  deleteScheduleCore,
  saveScheduleCore,
  triggerWateringCore,
  triggerLightingCore,
  triggerFertilizingCore,
  triggerPesticideCore,
  formatScheduleCadence,
} from './care'
import { internal } from './_generated/api'
import {
  ASSISTANT_MESSAGES_PER_THREAD_CAP,
  CARE_SCHEDULES_PER_PLANT_CAP,
  overflowBeyondCap,
} from './crons'
import { buildAssistantContext } from './assistant/context'
import {
  DAY_MS,
  getAssistantMessageLimit,
  getStartOfToday,
  getAssistantUsage,
  assertAssistantQuotaAvailable,
  quotaExceededMessage,
} from './assistant/quota'

export { buildAssistantContext } from './assistant/context'
export {
  DAY_MS,
  getAssistantMessageLimit,
  getStartOfToday,
  getAssistantUsage,
  quotaExceededMessage,
  assertAssistantQuotaAvailable,
} from './assistant/quota'

async function getAssistantThread(ctx: Ctx, userId: Id<'users'>) {
  return await ctx.db
    .query('assistantThreads')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .first()
}

async function getAssistantMessages(ctx: Ctx, threadId: Id<'assistantThreads'>, limit = 24) {
  const messages = await ctx.db
    .query('assistantMessages')
    .withIndex('by_createdAt', (q) => q.eq('threadId', threadId))
    .order('desc')
    .take(limit)

  return messages.reverse()
}

// Hard retention cap: 200 messages/thread, trim oldest. No grandfathering.
export async function trimAssistantThreadToCap(
  ctx: MutationCtx,
  threadId: Id<'assistantThreads'>,
) {
  while (true) {
    const newestFirst = await ctx.db
      .query('assistantMessages')
      .withIndex('by_createdAt', (q) => q.eq('threadId', threadId))
      .order('desc')
      .take(500)
    const overflow = overflowBeyondCap(newestFirst, ASSISTANT_MESSAGES_PER_THREAD_CAP)
    if (overflow.length === 0) break
    for (const message of overflow) {
      await ctx.db.delete(message._id)
    }
    if (newestFirst.length < 500) break
  }
}

export const assistant = query({
  args: {
    deviceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) return null

    const device = await getSelectedDevice(ctx, user._id, args.deviceId)
    const plant = device?.plantId ? await ctx.db.get(device.plantId) : null
    const thread = await getAssistantThread(ctx, user._id)

    const [rawMessages, supportRequests, schedules, sensors] = await Promise.all([
      thread ? getAssistantMessages(ctx, thread._id, 40) : Promise.resolve([]),
      ctx.db
        .query('supportRequests')
        .withIndex('by_user', (q) => q.eq('userId', user._id))
        .take(50),
      plant && !plant.archived
        ? ctx.db
            .query('careSchedules')
            .withIndex('by_plant', (q) => q.eq('plantId', plant._id))
            .take(3)
        : Promise.resolve([]),
      plant && !plant.archived
        ? ctx.db
            .query('sensors')
            .withIndex('by_plant', (q) => q.eq('plantId', plant._id))
            .take(10)
        : Promise.resolve([]),
    ])
    const quota = thread
      ? await getAssistantUsage(ctx, thread._id, user.tier)
      : {
          usedToday: 0,
          limit: getAssistantMessageLimit(user.tier),
          remainingToday: getAssistantMessageLimit(user.tier),
          resetsAt: getStartOfToday() + DAY_MS,
        }

    const messages = rawMessages.map((m) => ({
      ...m,
      createdAtLabel: formatTimestamp(m.createdAt),
    }))

    const supportThreads = await Promise.all(
      supportRequests
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map(async (request) => ({
          ...request,
          createdAtLabel: formatTimestamp(request.createdAt),
          updatedAtLabel: formatTimestamp(request.updatedAt),
          messages: (await getSupportMessages(ctx, request._id, 20)).map((message) => ({
            ...message,
            createdAtLabel: formatTimestamp(message.createdAt),
            mine: String(message.senderUserId) === String(user._id),
          })),
        })),
    )

    const recommendations: Array<{ sort: number; title: string; detail: string; accent: string }> = []
    let sort = 0

    if (!device) {
      recommendations.push({
        sort: sort++,
        title: 'Hubungkan perangkat pertama Anda',
        detail: 'Hubungkan GrowMate Pods agar pendampingan dan pemantauan dapat menyesuaikan kondisi perangkat Anda.',
        accent: 'bg-[#cae6ff] text-[#006493]',
      })
    } else if (!plant || plant.archived) {
      recommendations.push({
        sort: sort++,
        title: 'Tentukan tanaman yang sedang dibudidayakan',
        detail: `Pilih tanaman untuk ${device.name} agar Floral Assistant dapat memberi arahan perawatan yang lebih relevan.`,
        accent: 'bg-[#ffdbcf] text-[#795548]',
      })
    } else {
      const sensorProfile = normalizePlantSensorProfile(plant.sensorProfile)
      for (const sensor of sensors) {
        const status = getSensorStatus(sensor.kind as SensorKind, sensor.value, sensorProfile)

        if (sensor.kind === 'soil' && status === 'low') {
          recommendations.push({
            sort: sort++,
            title: 'Tanaman perlu penyiraman',
            detail: `${plant.name} memerlukan tambahan air. Jadwalkan penyiraman dalam waktu dekat.`,
            accent: 'bg-[#cae6ff] text-[#006493]',
          })
        }

        if (sensor.kind === 'water' && sensor.value < getSensorRange('water', sensorProfile).min) {
          recommendations.push({
            sort: sort++,
            title: 'Cadangan air perlu diisi ulang',
            detail: `${device.name} mulai kehabisan cadangan air untuk penyiraman.`,
            accent: 'bg-[#ffdbcf] text-[#795548]',
          })
        }

        if (sensor.kind === 'temperature' && status === 'high') {
          recommendations.push({
            sort: sort++,
            title: 'Suhu perlu diturunkan',
            detail: `Suhu di sekitar ${plant.name} sedang meningkat. Pertimbangkan sirkulasi udara atau pengurangan paparan panas.`,
            accent: 'bg-[#ffdbcf] text-[#795548]',
          })
        }
      }
    }

    if (user.tier === 'basic') {
      recommendations.push({
        sort: sort++,
        title: 'Tingkatkan paket penggunaan',
        detail: 'Dapatkan kapasitas pendampingan AI yang lebih luas dan prioritas dukungan yang lebih baik.',
        accent: 'bg-[#94f990]/40 text-[#005313]',
      })
    }

    const careNotifications = [
      ...(device
        ? [`Perangkat aktif saat ini: ${device.name}`]
        : ['Belum ada perangkat aktif yang dipilih']),
      ...schedules.map(
        (schedule) => `${schedule.title} dijadwalkan pada ${formatTimestamp(schedule.nextRunAt)}`,
      ),
      ...supportRequests
        .slice(0, 1)
        .map(
          (request) => `Permintaan dukungan "${request.topic}" berstatus ${request.status.replace('_', ' ')}`,
        ),
    ].slice(0, 3)

    return {
      user,
      device: device ? await buildDeviceSummary(ctx, device) : null,
      plant: plant && !plant.archived ? await buildPlantView(ctx, plant) : null,
      thread: thread ?? { title: 'Percakapan Floral Assistant' },
      messages,
      supportRequests: supportThreads,
      recommendations,
      careNotifications,
      quota,
    }
  },
})

export const assistantTriggerWatering = internalMutation({
  args: {
    userId: v.id('users'),
    deviceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId)
    if (!user) throw new ConvexError('Pengguna tidak ditemukan')

    const { device } = await triggerWateringCore(ctx, user, args.deviceId)
    return { success: true, deviceName: device.name }
  },
})

export const assistantTriggerLighting = internalMutation({
  args: {
    userId: v.id('users'),
    deviceId: v.optional(v.string()),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId)
    if (!user) throw new ConvexError('Pengguna tidak ditemukan')

    const { device, enabled } = await triggerLightingCore(ctx, user, args.deviceId, args.enabled)
    return { success: true, enabled, deviceName: device.name }
  },
})

export const assistantTriggerFertilizing = internalMutation({
  args: {
    userId: v.id('users'),
    deviceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId)
    if (!user) throw new ConvexError('Pengguna tidak ditemukan')

    const { device } = await triggerFertilizingCore(ctx, user, args.deviceId)
    return { success: true, deviceName: device.name }
  },
})

export const assistantTriggerPesticide = internalMutation({
  args: {
    userId: v.id('users'),
    deviceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId)
    if (!user) throw new ConvexError('Pengguna tidak ditemukan')

    const { device } = await triggerPesticideCore(ctx, user, args.deviceId)
    return { success: true, deviceName: device.name }
  },
})

export const assistantCreateSupportRequest = internalMutation({
  args: {
    userId: v.id('users'),
    topic: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId)
    if (!user) throw new ConvexError('Pengguna tidak ditemukan')

    const topic = args.topic.trim()
    if (!topic) throw new ConvexError('Topik dukungan wajib diisi')

    const now = Date.now()
    const requestId = await ctx.db.insert('supportRequests', {
      userId: user._id,
      topic,
      status: 'open',
      priority: 'normal',
      createdAt: now,
      updatedAt: now,
    })

    await ctx.db.insert('supportMessages', {
      requestId,
      senderUserId: user._id,
      senderRole: 'user',
      body: topic,
      createdAt: now,
    })

    await ctx.db.insert('notifications', {
      userId: user._id,
      title: 'Permintaan dukungan dibuka',
      detail: `Permintaan Anda tentang ${topic.toLowerCase()} sudah kami catat dan masuk ke antrean dukungan.`,
      kind: 'assistant',
      read: false,
      createdAt: now,
    })

    return { success: true, requestId, topic }
  },
})

export const assistantToggleSchedule = internalMutation({
  args: {
    userId: v.id('users'),
    scheduleId: v.id('careSchedules'),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId)
    if (!user) throw new ConvexError('Pengguna tidak ditemukan')

    const { title, enabled } = await toggleScheduleCore(ctx, user, args.scheduleId, args.enabled)
    return { success: true, title, enabled }
  },
})

export const assistantDeleteSchedule = internalMutation({
  args: {
    userId: v.id('users'),
    scheduleId: v.id('careSchedules'),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId)
    if (!user) throw new ConvexError('Pengguna tidak ditemukan')

    const { title } = await deleteScheduleCore(ctx, user, args.scheduleId)
    return { success: true, title }
  },
})

export const assistantCreateSchedule = internalMutation({
  args: {
    userId: v.id('users'),
    deviceId: v.optional(v.string()),
    title: v.string(),
    cadenceUnit: v.union(v.literal('hours'), v.literal('days')),
    cadenceValue: v.number(),
    timeOfDayMinutes: v.optional(v.number()),
    timezoneOffsetMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId)
    if (!user) throw new ConvexError('Pengguna tidak ditemukan')

    // Hard cap: 20 schedules/plant — reject over cap, no grandfathering.
    const device = await getSelectedDevice(ctx, user._id, args.deviceId)
    const plant = device?.plantId ? await ctx.db.get(device.plantId) : null
    if (plant && !plant.archived) {
      const existing = await ctx.db
        .query('careSchedules')
        .withIndex('by_plant', (q) => q.eq('plantId', plant._id))
        .take(CARE_SCHEDULES_PER_PLANT_CAP + 1)
      if (existing.length >= CARE_SCHEDULES_PER_PLANT_CAP) {
        throw new ConvexError(
          'Batas jadwal perawatan tercapai (maksimal 20 per tanaman). Hapus jadwal yang tidak dipakai sebelum menambah.',
        )
      }
    }

    const { scheduleId, title, cadence } = await saveScheduleCore(ctx, user, args)
    return { success: true, scheduleId, title, cadenceLabel: formatScheduleCadence(cadence) }
  },
})

export const sendAssistantMessage = mutation({
  args: {
    body: v.string(),
    deviceId: v.optional(v.string()),
    timezoneOffsetMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const now = Date.now()

    let thread = await getAssistantThread(ctx, user._id)
    if (!thread) {
      const threadId = await ctx.db.insert('assistantThreads', {
        userId: user._id,
        title: 'Percakapan Floral Assistant',
        createdAt: now,
        updatedAt: now,
      })
      thread = await ctx.db.get(threadId)
    }

    if (!thread) throw new ConvexError('Percakapan asisten tidak dapat dimulai')

    const trimmedBody = args.body.trim()
    if (!trimmedBody) throw new ConvexError('Pesan tidak boleh kosong')

    // Pre-check: fast-path rejection without writing anything.
    const quota = await getAssistantUsage(ctx, thread._id, user.tier)
    assertAssistantQuotaAvailable(quota)

    // Ownership before writes: a rejected foreign deviceId must not leave rows.
    const device = await getSelectedDevice(ctx, user._id, args.deviceId)
    const plant = device?.plantId ? await ctx.db.get(device.plantId) : null

    // Single-flight quota design: re-check AFTER our reservation rows are
    // visible, and roll back + throw on exceed BEFORE any AI actuation
    // (scheduler/trim below). Chosen over insert-a-reservation-first because
    // it needs no schema or reservation lifecycle: the user's own message row
    // IS the reservation, and the post-insert recount closes the
    // read-check-insert race (double-click / two tabs with 1 quota left) so
    // at most one flight can consume the last slot. Rollback deletes only the
    // two rows this call inserted, never other users' or earlier messages.
    const userMessageId = await ctx.db.insert('assistantMessages', {
      threadId: thread._id,
      role: 'user',
      body: trimmedBody,
      status: 'complete',
      createdAt: now,
    })

    const assistantMessageId = await ctx.db.insert('assistantMessages', {
      threadId: thread._id,
      role: 'assistant',
      body: '',
      status: 'streaming',
      createdAt: now + 1,
    })

    const after = await getAssistantUsage(ctx, thread._id, user.tier)
    if (after.usedToday > after.limit) {
      await ctx.db.delete(userMessageId)
      await ctx.db.delete(assistantMessageId)
      throw new ConvexError(quotaExceededMessage(after.limit))
    }

    // Hard retention cap: trim oldest beyond 200/thread on every insert.
    await trimAssistantThreadToCap(ctx, thread._id)

    const [chatHistory, assistantContext] = await Promise.all([
      getAssistantMessages(ctx, thread._id, 24),
      buildAssistantContext(ctx, user, device, plant, args.timezoneOffsetMinutes),
    ])

    await ctx.scheduler.runAfter(0, internal.openai.generateAIResponse, {
      threadId: thread._id,
      assistantMessageId,
      userId: user._id,
      deviceId: device?.deviceId,
      chatHistory: chatHistory.map((message) => ({
        role: message.role,
        body: message.body,
        createdAt: message.createdAt,
      })),
      context: assistantContext,
    })

    await ctx.db.patch(thread._id, { updatedAt: now })
    return {
      success: true,
      quota: {
        usedToday: after.usedToday,
        limit: after.limit,
        remainingToday: Math.max(0, after.limit - after.usedToday),
        resetsAt: after.resetsAt,
      },
    }
  },
})

export const MAX_AI_RESPONSE_CAP = 4000

export const insertAIResponse = internalMutation({
  args: {
    assistantMessageId: v.id('assistantMessages'),
    body: v.string(),
    status: v.union(v.literal('streaming'), v.literal('complete'), v.literal('error')),
  },
  handler: async (ctx, args) => {
    let body = args.body
    if (body.length > MAX_AI_RESPONSE_CAP) {
      console.warn(
        `[assistant] AI response truncated from ${body.length} to ${MAX_AI_RESPONSE_CAP} chars`,
      )
      body = body.slice(0, MAX_AI_RESPONSE_CAP)
    }
    await ctx.db.patch(args.assistantMessageId, {
      body,
      status: args.status,
    })
    return { success: true }
  },
})

export const resetAssistantThread = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx)
    const thread = await getAssistantThread(ctx, user._id)
    if (!thread) return { success: true }

    let batch = await ctx.db
      .query('assistantMessages')
      .withIndex('by_thread', (q) => q.eq('threadId', thread._id))
      .take(64)

    while (batch.length > 0) {
      for (const message of batch) {
        await ctx.db.delete(message._id)
      }
      batch = await ctx.db
        .query('assistantMessages')
        .withIndex('by_thread', (q) => q.eq('threadId', thread._id))
        .take(64)
    }

    await ctx.db.delete(thread._id)
    return { success: true }
  },
})
