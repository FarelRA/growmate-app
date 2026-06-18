import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { DeviceDoc } from './types'
import {
  getCurrentUser, requireUser,
  recordGrowEvent,
  getUserDevices,
} from './helpers'

function normalizeHandle(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s.]/g, '')
    .replace(/\s+/g, '.')
}

function buildSetupStatus(user: import('./types').UserDoc, devices: DeviceDoc[]) {
  if (user.role === 'admin') {
    return {
      authenticated: true,
      hasProfile: Boolean(user?.name),
      hasDevice: false,
      setupComplete: true,
      devicesCount: 0,
      configuredDevicesCount: 0,
      needsPlantSelection: false,
      nextStep: 'done' as const,
      nextDeviceId: null,
      role: 'admin' as const,
      isAdmin: true,
    }
  }

  const hasProfile = Boolean(user?.name)
  const hasDevice = devices.length > 0
  const configuredDevices = devices.filter((device) => Boolean(device.plantId))
  const needsPlantDevice = devices.find((device) => !device.plantId) ?? null
  const setupComplete = hasProfile && configuredDevices.length > 0

  let nextStep: 'complete-profile' | 'claim-device' | 'select-plant' | 'done' = 'done'
  if (!hasProfile) {
    nextStep = 'complete-profile'
  } else if (!hasDevice) {
    nextStep = 'claim-device'
  } else if (configuredDevices.length === 0 && needsPlantDevice) {
    nextStep = 'select-plant'
  }

  return {
    authenticated: true,
    hasProfile,
    hasDevice,
    setupComplete,
    devicesCount: devices.length,
    configuredDevicesCount: configuredDevices.length,
    needsPlantSelection: Boolean(needsPlantDevice),
    nextStep,
    nextDeviceId:
      needsPlantDevice?.deviceId ?? configuredDevices[0]?.deviceId ?? devices[0]?.deviceId ?? null,
    role: user.role ?? 'grower',
    isAdmin: false,
  }
}

export const completeProfile = mutation({
  args: {
    name: v.string(),
    handle: v.optional(v.string()),
    role: v.optional(v.union(v.literal('grower'), v.literal('company'))),
    avatar: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) throw new Error('Anda harus masuk terlebih dahulu')

    const handle = normalizeHandle(args.handle?.trim() || args.name)
    const existingHandle = await ctx.db
      .query('users')
      .withIndex('by_handle', (q) => q.eq('handle', handle))
      .first()
    if (existingHandle && String(existingHandle._id) !== String(user._id)) {
      throw new Error('Nama pengguna tersebut sudah digunakan')
    }

    const now = Date.now()
    await ctx.db.patch(user._id, {
      name: args.name.trim(),
      handle,
      role: args.role || 'grower',
      tier: 'basic',
      avatar:
        args.avatar ||
        args.name
          .split(' ')
          .map((n) => n[0])
          .join('')
          .toUpperCase(),
      updatedAt: now,
    })

    return { success: true }
  },
})

export const claimDevice = mutation({
  args: {
    deviceId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) throw new Error('Anda harus masuk terlebih dahulu')
    if (!user.name) throw new Error('Lengkapi profil Anda terlebih dahulu')

    const device = await ctx.db
      .query('devices')
      .withIndex('by_deviceId', (q) => q.eq('deviceId', args.deviceId))
      .first()

    if (!device) {
      throw new Error('Perangkat tidak ditemukan. Periksa kembali ID perangkat lalu coba lagi.')
    }

    if (device.userId) {
      throw new Error('Perangkat ini sudah terhubung ke akun lain')
    }

    const now = Date.now()

    await ctx.db.patch(device._id, {
      userId: user._id,
      plantId: undefined,
      updatedAt: now,
    })

    await recordGrowEvent(ctx, {
      deviceId: device._id,
      userId: user._id,
      source: 'user',
      entityType: 'device',
      eventType: 'device_claimed',
      title: 'Perangkat diklaim',
      detail: `${device.name} berhasil dihubungkan ke ${user.name || user.email || 'akun ini'}.`,
      data: { deviceId: device.deviceId },
      timestamp: now,
    })

    return {
      success: true,
      device: {
        _id: device._id,
        deviceId: device.deviceId,
        name: device.name,
      },
    }
  },
})

export const checkSetupStatus = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx)
    if (!user)
      return { authenticated: false, hasProfile: false, hasDevice: false, setupComplete: false }

    const devices = await getUserDevices(ctx, user._id)
    return buildSetupStatus(user, devices)
  },
})

export const currentUserProfile = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx)
    if (!user) return null

    return {
      _id: user._id,
      email: user.email ?? '',
      name: user.name ?? '',
      handle: user.handle ?? '',
      avatar: user.avatar ?? '',
      role: user.role ?? 'grower',
      tier: user.tier ?? 'basic',
      setupComplete: Boolean(user.setupComplete),
    }
  },
})

export const updateCurrentUserProfile = mutation({
  args: {
    name: v.string(),
    handle: v.string(),
    avatar: v.optional(v.string()),
    role: v.optional(v.union(v.literal('grower'), v.literal('company'))),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const normalizedHandle = normalizeHandle(args.handle || args.name)
    const existingHandle = await ctx.db
      .query('users')
      .withIndex('by_handle', (q) => q.eq('handle', normalizedHandle))
      .first()
    if (existingHandle && String(existingHandle._id) !== String(user._id)) {
      throw new Error('Nama pengguna tersebut sudah digunakan')
    }

    await ctx.db.patch(user._id, {
      name: args.name.trim(),
      handle: normalizedHandle,
      avatar:
        args.avatar?.trim() ||
        args.name
          .split(' ')
          .map((part) => part[0])
          .join('')
          .toUpperCase(),
      role: user.role === 'admin' ? 'admin' : (args.role ?? user.role ?? 'grower'),
      updatedAt: Date.now(),
    })

    return { success: true }
  },
})
