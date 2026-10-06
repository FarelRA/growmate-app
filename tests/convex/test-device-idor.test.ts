import { describe, it, expect } from 'vitest'

import { getUnclaimedDevice } from '../../convex/devices'
import { createFakeCtx, callHandler, type FakeCtx } from './test-ingest-rules-fake'

const now = Date.now()

async function seedDevice(
  ctx: FakeCtx,
  externalId: string,
  opts: { userId?: string; firmwareVersion?: string } = {},
): Promise<string> {
  return await ctx.db.insert('devices', {
    deviceId: externalId,
    name: `Pod ${externalId}`,
    ...(opts.userId !== undefined ? { userId: opts.userId } : {}),
    ...(opts.firmwareVersion !== undefined ? { firmwareVersion: opts.firmwareVersion } : {}),
    createdAt: now,
    updatedAt: now,
  })
}

async function seedUser(ctx: FakeCtx, name = 'Grower'): Promise<string> {
  return await ctx.db.insert('users', {
    name,
    role: 'user',
    points: 0,
    setupComplete: false,
    createdAt: now,
    updatedAt: now,
  })
}

describe('getUnclaimedDevice oracle closure', () => {
  it('unauthenticated caller learns nothing beyond deviceId+name', async () => {
    const ctx = createFakeCtx(null)
    await seedDevice(ctx, 'GM-ORACLE', { firmwareVersion: '9.9.9-secret' })

    const result = await callHandler(getUnclaimedDevice, ctx, { deviceId: 'GM-ORACLE' })

    expect(result).not.toBeNull()
    expect(Object.keys(result).sort()).toEqual(['deviceId', 'name'])
    expect(result).toEqual({ deviceId: 'GM-ORACLE', name: 'Pod GM-ORACLE' })
  })

  it('never exposes firmwareVersion even when the device reports one', async () => {
    const ctx = createFakeCtx(null)
    await seedDevice(ctx, 'GM-FW', { firmwareVersion: '2.1.3' })

    const result = await callHandler(getUnclaimedDevice, ctx, { deviceId: 'GM-FW' })

    expect(result).not.toBeNull()
    expect(result).not.toHaveProperty('firmwareVersion')
    expect(JSON.stringify(result)).not.toContain('2.1.3')
  })

  it('never exposes owner info for claimed devices', async () => {
    const ctx = createFakeCtx(null)
    const ownerId = await seedUser(ctx, 'Owner')
    await seedDevice(ctx, 'GM-CLAIMED', { userId: ownerId, firmwareVersion: '3.0.1' })

    const result = await callHandler(getUnclaimedDevice, ctx, { deviceId: 'GM-CLAIMED' })

    expect(result).toBeNull()
  })

  it('does not distinguish claimed from nonexistent ids (both null)', async () => {
    const ctx = createFakeCtx(null)
    const ownerId = await seedUser(ctx, 'Owner')
    await seedDevice(ctx, 'GM-CLAIMED', { userId: ownerId })

    const claimed = await callHandler(getUnclaimedDevice, ctx, { deviceId: 'GM-CLAIMED' })
    const missing = await callHandler(getUnclaimedDevice, ctx, { deviceId: 'GM-NOPE' })

    expect(claimed).toBeNull()
    expect(missing).toBeNull()
  })
})
