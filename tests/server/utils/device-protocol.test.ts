import { describe, it, expect, beforeEach, vi } from 'vitest'

function mockEvent() {
  return { headers: new Headers(), context: {} as Record<string, unknown> }
}

describe('validateDeviceEnvelope edge hardening', () => {
  let validateDeviceEnvelope: typeof import('../../../../server/utils/deviceProtocol').validateDeviceEnvelope

  beforeEach(async () => {
    vi.resetModules()
    ;({ validateDeviceEnvelope } = await import('../../../../server/utils/deviceProtocol'))
  })

  function baseEnvelope(overrides: Record<string, unknown> = {}) {
    return {
      deviceId: 'IAET01',
      hardwareId: 'AA1122334455',
      firmwareVersion: '2.0.0',
      snapshotId: 'B1-1',
      ageMs: 1000,
      appliedConfigRev: 0,
      sensors: [{ kind: 'soil', unit: '%', raw: 2048 }],
      acceptedCommandIds: [],
      currentState: { pumpEnabled: false, lightEnabled: false },
      ...overrides,
    }
  }

  it('uppercases a lowercase hardwareId instead of forking identity', () => {
    const env = validateDeviceEnvelope(baseEnvelope({ hardwareId: 'aa1122334455' }))
    expect(env.hardwareId).toBe('AA1122334455')
  })

  it('rejects snapshot ids outside B<boot>-<seq>', () => {
    for (const snapshotId of ['snap-1', 'B1', 'B-1', 'B1-', 'X1-1', 'B1-1 ', '']) {
      expect(() => validateDeviceEnvelope(baseEnvelope({ snapshotId })), snapshotId).toThrowError(
        /snapshotId/,
      )
    }
    expect(validateDeviceEnvelope(baseEnvelope({ snapshotId: 'B12-345' })).snapshotId).toBe(
      'B12-345',
    )
  })

  it('requires boolean pump/light legs in currentState', () => {
    expect(() =>
      validateDeviceEnvelope(baseEnvelope({ currentState: { pumpEnabled: 'off' } })),
    ).toThrowError(/currentState\.pumpEnabled must be boolean/)
    expect(() =>
      validateDeviceEnvelope(baseEnvelope({ currentState: { pumpEnabled: true } })),
    ).toThrowError(/currentState\.lightEnabled must be boolean/)
    expect(() =>
      validateDeviceEnvelope(baseEnvelope({ currentState: { pumpEnabled: false, lightEnabled: false, streaming: 'yes' } })),
    ).toThrowError(/currentState\.streaming must be boolean/)
    expect(() =>
      validateDeviceEnvelope(
        baseEnvelope({ currentState: { pumpEnabled: false, lightEnabled: true, streaming: true, streamFps: 5 } }),
      ),
    ).not.toThrow()
  })
})

describe('device rate limits', () => {
  beforeEach(async () => {
    vi.resetModules()
  })

  it('429s the 4th sensors burst with a Retry-After header', async () => {
    const { checkSensorRateLimit } = await import('../../../../server/utils/deviceProtocol')
    const event = mockEvent()
    checkSensorRateLimit(event as never, 'burst-dev')
    checkSensorRateLimit(event as never, 'burst-dev')
    checkSensorRateLimit(event as never, 'burst-dev')
    expect(() => checkSensorRateLimit(event as never, 'burst-dev')).toThrowError(/Rate limited/)
    expect((event as unknown as { __headers: Record<string, string> }).__headers['Retry-After'])
      .toBeTruthy()
  })

  it('429s a second camera frame inside the 5-minute gap', async () => {
    const { checkCameraRateLimit } = await import('../../../../server/utils/deviceProtocol')
    const event = mockEvent()
    checkCameraRateLimit(event as never, 'cam-dev')
    expect(() => checkCameraRateLimit(event as never, 'cam-dev')).toThrowError(/Rate limited/)
  })
})
