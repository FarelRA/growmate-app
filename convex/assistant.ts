import { v } from 'convex/values'
import { query, mutation, internalMutation } from './_generated/server'
import type { Id } from './_generated/dataModel'
import type { Ctx, UserDoc, DeviceDoc, PlantDoc, SensorDoc, CareScheduleDoc, SensorKind } from './types'
import {
  getCurrentUser, requireUser, getSelectedDevice, getRecentGrowEvents, getRecentAutomationLogs,
  getSupportMessages, buildDeviceSummary, buildPlantView, formatTimestamp,
  normalizePlantSensorProfile, getSensorStatus, getSensorLabel, getSensorTarget,
  getSensorRange, computePlantHealth, formatPlantStage, getDeviceWateringDuration,
  getDeviceWateringCooldown, getDeviceLightingHysteresis,
  recordGrowEvent, computePlantProgress,
  executeManualWatering, executeManualLighting,
} from './helpers'
import { formatScheduleSummary, normalizeScheduleCadence, computeNextRunAtFromCadence, formatScheduleCadence } from './care'
import { internal } from './_generated/api'

export function getAssistantMessageLimit(tier?: 'basic' | 'advanced') {
  return tier === 'advanced' ? 100 : 20
}

function getStartOfToday() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  return start.getTime()
}

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

async function getAssistantUsage(
  ctx: Ctx,
  threadId: Id<'assistantThreads'>,
  tier?: 'basic' | 'advanced',
) {
  const startOfToday = getStartOfToday()
  const recentMessages = await ctx.db
    .query('assistantMessages')
    .withIndex('by_createdAt', (q) => q.eq('threadId', threadId))
    .order('desc')
    .take(160)

  const usedToday = recentMessages.filter(
    (message) => message.role === 'user' && message.createdAt >= startOfToday,
  ).length
  const limit = getAssistantMessageLimit(tier)

  return {
    usedToday,
    limit,
    remainingToday: Math.max(0, limit - usedToday),
    resetsAt: startOfToday + 24 * 60 * 60 * 1000,
  }
}

async function buildAssistantContext(
  ctx: Ctx,
  user: UserDoc,
  device: DeviceDoc | null,
  plant: PlantDoc | null,
) {
  const activePlant = plant && !plant.archived ? plant : null
  const deviceWithPlant = plant && !plant.archived && device ? device : null
  let sensors: SensorDoc[] = []
  let schedules: CareScheduleDoc[] = []
  let recentEvents: Awaited<ReturnType<typeof getRecentGrowEvents>> = []
  let automationLogs: Awaited<ReturnType<typeof getRecentAutomationLogs>> = []

  if (deviceWithPlant && activePlant) {
    ;[sensors, schedules, recentEvents, automationLogs] = await Promise.all([
      ctx.db
        .query('sensors')
        .withIndex('by_plant', (q) => q.eq('plantId', activePlant._id))
        .collect(),
      ctx.db
        .query('careSchedules')
        .withIndex('by_plant', (q) => q.eq('plantId', activePlant._id))
        .take(5),
      getRecentGrowEvents(ctx, deviceWithPlant._id, 8),
      getRecentAutomationLogs(ctx, activePlant._id, 6),
    ])
  } else {
    recentEvents = device ? await getRecentGrowEvents(ctx, device._id, 8) : []
  }

  const sensorProfile = activePlant ? normalizePlantSensorProfile(activePlant.sensorProfile) : null

  const sensorSummaries = sensors.map((sensor) => ({
    kind: sensor.kind,
    label: getSensorLabel(sensor.kind as SensorKind),
    value: sensor.value,
    unit: sensor.unit,
    status: getSensorStatus(sensor.kind as SensorKind, sensor.value, sensorProfile),
    target: getSensorTarget(
      sensor.kind as SensorKind,
      sensor.value,
      getSensorStatus(sensor.kind as SensorKind, sensor.value, sensorProfile),
      sensorProfile,
    ),
  }))

  return {
    user: {
      name: user.name ?? 'Pengguna GrowMate',
      tier: user.tier ?? 'basic',
    },
    activeDevice: device
      ? {
          name: device.name,
          deviceId: device.deviceId,
          autoWatering: device.autoWatering,
          autoLighting: device.autoLighting,
          wateringThreshold: device.wateringThreshold,
          wateringDuration: getDeviceWateringDuration(device),
          wateringCooldown: getDeviceWateringCooldown(device),
          lightingThreshold: device.lightingThreshold,
          lightingHysteresis: getDeviceLightingHysteresis(device),
          lightEnabled: device.lightEnabled,
          lastSeen: formatTimestamp(device.lastSeen),
        }
      : null,
    activePlant:
      plant && !plant.archived
        ? {
            name: plant.name,
            species: plant.species,
            health: computePlantHealth(
              sensorSummaries.map((sensor) => ({ kind: sensor.kind as SensorKind, value: sensor.value })),
              sensorProfile,
            ),
            growthStage: formatPlantStage(plant.growthStage),
            location: plant.location,
            wateringThreshold: plant.wateringThreshold,
            lightingThreshold: plant.lightingThreshold,
            sensorProfile,
            progress: computePlantProgress(plant),
            lifecycleProfile: plant.lifecycleProfile,
          }
        : null,
    sensors: sensorSummaries,
    schedules: schedules.map((schedule) => {
      const summary = formatScheduleSummary(schedule)
      return {
        title: schedule.title,
        enabled: schedule.enabled,
        nextRunAt: formatTimestamp(schedule.nextRunAt),
        lastRunAt: schedule.lastRunAt ? formatTimestamp(schedule.lastRunAt) : null,
        cadenceUnit: summary.cadence.unit,
        cadenceValue: summary.cadence.value,
        timeOfDayMinutes: summary.cadence.timeOfDayMinutes,
        cadenceLabel: summary.cadenceLabel,
        timeLabel: summary.timeLabel,
      }
    }),
    recentEvents: recentEvents.map((event) => ({
      title: event.title,
      detail: event.detail,
      time: event.relativeTime,
    })),
    automationLogs: automationLogs.map((log) => ({
      action: log.action,
      soilValue: log.soilValue,
      lightValue: log.lightValue,
      threshold: log.threshold,
      duration: log.duration,
      time: log.relativeTime,
    })),
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
            .collect()
        : Promise.resolve([]),
    ])
    const quota = thread
      ? await getAssistantUsage(ctx, thread._id, user.tier)
      : {
          usedToday: 0,
          limit: getAssistantMessageLimit(user.tier),
          remainingToday: getAssistantMessageLimit(user.tier),
          resetsAt: getStartOfToday() + 24 * 60 * 60 * 1000,
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
    if (!user) throw new Error('Pengguna tidak ditemukan')

    const device = await getSelectedDevice(ctx, user._id, args.deviceId)
    if (!device) throw new Error('Perangkat tidak ditemukan')

    await executeManualWatering(ctx, user, device)
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
    if (!user) throw new Error('Pengguna tidak ditemukan')

    const device = await getSelectedDevice(ctx, user._id, args.deviceId)
    if (!device) throw new Error('Perangkat tidak ditemukan')

    await executeManualLighting(ctx, user, device, args.enabled)
    return { success: true, enabled: args.enabled, deviceName: device.name }
  },
})

export const assistantCreateSupportRequest = internalMutation({
  args: {
    userId: v.id('users'),
    topic: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId)
    if (!user) throw new Error('Pengguna tidak ditemukan')

    const topic = args.topic.trim()
    if (!topic) throw new Error('Topik dukungan wajib diisi')

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
    if (!user) throw new Error('Pengguna tidak ditemukan')

    const schedule = await ctx.db.get(args.scheduleId)
    if (!schedule) throw new Error('Jadwal tidak ditemukan')

    const plant = await ctx.db.get(schedule.plantId)
    if (!plant) throw new Error('Tanaman tidak ditemukan')

    const device = await ctx.db.get(plant.deviceId)
    if (!device || String(device.userId) !== String(user._id)) throw new Error('Jadwal tidak ditemukan')

    await ctx.db.patch(args.scheduleId, { enabled: args.enabled })
    await recordGrowEvent(ctx, {
      deviceId: device._id,
      plantId: plant._id,
      userId: user._id,
      source: 'user',
      entityType: 'schedule',
      eventType: 'care_schedule_toggled',
      title: args.enabled ? 'Jadwal diaktifkan' : 'Jadwal dijeda',
      detail: `${schedule.title} ${args.enabled ? 'kembali dijalankan' : 'sementara dijeda'}.`,
      data: { enabled: args.enabled },
      timestamp: Date.now(),
    })

    return { success: true, title: schedule.title, enabled: args.enabled }
  },
})

export const assistantDeleteSchedule = internalMutation({
  args: {
    userId: v.id('users'),
    scheduleId: v.id('careSchedules'),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId)
    if (!user) throw new Error('Pengguna tidak ditemukan')

    const schedule = await ctx.db.get(args.scheduleId)
    if (!schedule) throw new Error('Jadwal tidak ditemukan')
    const plant = await ctx.db.get(schedule.plantId)
    if (!plant) throw new Error('Tanaman tidak ditemukan')
    const device = await ctx.db.get(plant.deviceId)
    if (!device || String(device.userId) !== String(user._id)) throw new Error('Jadwal tidak ditemukan')

    await ctx.db.delete(args.scheduleId)
    await recordGrowEvent(ctx, {
      deviceId: device._id,
      plantId: plant._id,
      userId: user._id,
      source: 'user',
      entityType: 'schedule',
      eventType: 'care_schedule_deleted',
      title: 'Jadwal dihapus',
      detail: `${schedule.title} telah dihapus dari daftar perawatan berulang.`,
      timestamp: Date.now(),
    })
    return { success: true, title: schedule.title }
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
    if (!user) throw new Error('Pengguna tidak ditemukan')
    const device = await getSelectedDevice(ctx, user._id, args.deviceId)
    if (!device || !device.plantId) throw new Error('Perangkat dengan tanaman aktif tidak ditemukan')
    const plant = await ctx.db.get(device.plantId)
    if (!plant || plant.archived) throw new Error('Tanaman tidak ditemukan')
    const now = Date.now()
    const title = args.title.trim()
    if (!title) throw new Error('Judul jadwal wajib diisi')

    const cadence = normalizeScheduleCadence(args)
    const nextRunAt = computeNextRunAtFromCadence(cadence, now)
    const scheduleId = await ctx.db.insert('careSchedules', {
      plantId: plant._id,
      title,
      cadenceUnit: cadence.unit,
      cadenceValue: cadence.value,
      timeOfDayMinutes: cadence.timeOfDayMinutes ?? undefined,
      timezoneOffsetMinutes: cadence.timezoneOffsetMinutes,
      nextRunAt,
      enabled: true,
      createdAt: now,
    })

    await recordGrowEvent(ctx, {
      deviceId: device._id,
      plantId: plant._id,
      userId: user._id,
      source: 'user',
      entityType: 'schedule',
      eventType: 'care_schedule_saved',
      title: 'Jadwal dibuat',
      detail: `${title} akan berjalan ${formatScheduleCadence(cadence).toLowerCase()}.`,
      data: {
        cadenceValue: cadence.value,
        cadenceHours: cadence.unit === 'hours' ? cadence.value : cadence.value * 24,
        cadenceUnit: cadence.unit,
      },
      timestamp: now,
    })

    return { success: true, scheduleId, title, cadenceLabel: formatScheduleCadence(cadence) }
  },
})

export const sendAssistantMessage = mutation({
  args: {
    body: v.string(),
    deviceId: v.optional(v.string()),
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

    if (!thread) throw new Error('Percakapan asisten tidak dapat dimulai')

    const trimmedBody = args.body.trim()
    if (!trimmedBody) throw new Error('Pesan tidak boleh kosong')

    const quota = await getAssistantUsage(ctx, thread._id, user.tier)
    if (quota.remainingToday <= 0) {
      throw new Error(
        `Batas penggunaan asisten harian sudah tercapai. Paket Anda saat ini memiliki ${quota.limit} pesan per hari.`,
      )
    }

    await ctx.db.insert('assistantMessages', {
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

    const device = await getSelectedDevice(ctx, user._id, args.deviceId)
    const plant = device?.plantId ? await ctx.db.get(device.plantId) : null
    const [chatHistory, assistantContext] = await Promise.all([
      getAssistantMessages(ctx, thread._id, 24),
      buildAssistantContext(ctx, user, device, plant),
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
        usedToday: quota.usedToday + 1,
        limit: quota.limit,
        remainingToday: Math.max(0, quota.remainingToday - 1),
        resetsAt: quota.resetsAt,
      },
    }
  },
})

export const insertAIResponse = internalMutation({
  args: {
    assistantMessageId: v.id('assistantMessages'),
    body: v.string(),
    status: v.union(v.literal('streaming'), v.literal('complete'), v.literal('error')),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.assistantMessageId, {
      body: args.body,
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
