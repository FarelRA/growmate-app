/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { getAiBackendStatus, generateAIResponse } from '../../convex/openai'
import {
  deleteRecordingS3Object,
  recordS3SkipWarning,
  s3SkipWarningDayStart,
  S3_SKIP_WARNING_TITLE,
} from '../../convex/crons'
import { createFakeCtx, callHandler, type FakeCtx } from './test-ingest-rules-fake'

const AI_KEYS = ['OPENAI_BASE_URL', 'OPENAI_API_KEY', 'OPENAI_MODEL'] as const
const RUSTFS_KEYS = ['RUSTFS_ENDPOINT', 'RUSTFS_ACCESS_KEY', 'RUSTFS_SECRET_KEY'] as const

const savedEnv: Record<string, string | undefined> = {}

beforeEach(() => {
  for (const key of [...AI_KEYS, ...RUSTFS_KEYS]) savedEnv[key] = process.env[key]
})

afterEach(() => {
  for (const key of [...AI_KEYS, ...RUSTFS_KEYS]) {
    const value = savedEnv[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  vi.restoreAllMocks()
})

function setAiEnv(values: Partial<Record<(typeof AI_KEYS)[number], string | undefined>>) {
  for (const key of AI_KEYS) {
    const value = values[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

describe('getAiBackendStatus matrix', () => {
  it('reports configured when all three vars are set', () => {
    setAiEnv({
      OPENAI_BASE_URL: 'https://example.test/v1',
      OPENAI_API_KEY: 'sk-test',
      OPENAI_MODEL: 'test-model',
    })
    expect(getAiBackendStatus()).toEqual({ configured: true, missing: [] })
  })

  it.each([...AI_KEYS])('reports unconfigured when only %s is missing', (missingKey) => {
    const values: Record<string, string> = {
      OPENAI_BASE_URL: 'https://example.test/v1',
      OPENAI_API_KEY: 'sk-test',
      OPENAI_MODEL: 'test-model',
    }
    delete values[missingKey]
    setAiEnv(values)
    const status = getAiBackendStatus()
    expect(status.configured).toBe(false)
    expect(status.missing).toEqual([missingKey])
  })

  it('treats blank values as missing', () => {
    setAiEnv({
      OPENAI_BASE_URL: 'https://example.test/v1',
      OPENAI_API_KEY: '   ',
      OPENAI_MODEL: 'test-model',
    })
    const status = getAiBackendStatus()
    expect(status.configured).toBe(false)
    expect(status.missing).toEqual(['OPENAI_API_KEY'])
  })

  it('lists every missing var when none are set', () => {
    setAiEnv({})
    expect(getAiBackendStatus()).toEqual({
      configured: false,
      missing: ['OPENAI_BASE_URL', 'OPENAI_API_KEY', 'OPENAI_MODEL'],
    })
  })
})

describe('generateAIResponse fail-fast on misconfiguration', () => {
  it('throws the localized error before any DB writes when unconfigured', async () => {
    setAiEnv({})
    const runMutation = vi.fn(async () => {
      throw new Error('runMutation must not be called on misconfiguration')
    })
    const ctx = { runMutation } as any
    await expect(
      (generateAIResponse as any)._handler(ctx, {
        threadId: 'assistantThreads|1',
        assistantMessageId: 'assistantMessages|1',
        userId: 'users|1',
        deviceId: undefined,
        chatHistory: [],
        context: {
          user: { name: 'U' },
          activeDevice: null,
          activePlant: null,
          sensors: [],
          schedules: [],
          recentEvents: [],
          automationLogs: [],
        },
      }),
    ).rejects.toThrow(
      'Asisten Floral tidak tersedia karena OPENAI_API_KEY belum dikonfigurasi.',
    )
    expect(runMutation).not.toHaveBeenCalled()
  })
})

describe('s3SkipWarningDayStart', () => {
  it('floors a timestamp to UTC midnight', () => {
    expect(s3SkipWarningDayStart(Date.UTC(2026, 9, 6, 10, 30, 15))).toBe(
      Date.UTC(2026, 9, 6, 0, 0, 0),
    )
  })
})

describe('recordS3SkipWarning dedup', () => {
  const dayOne = Date.UTC(2026, 9, 6, 10, 0, 0)

  it('records one admin-visible warning row per day', async () => {
    const ctx = createFakeCtx()
    const first = await callHandler(recordS3SkipWarning, ctx, {
      key: 'rec-a.mp4',
      now: dayOne,
    })
    expect(first).toEqual({ recorded: true, deduped: false })
    const second = await callHandler(recordS3SkipWarning, ctx, {
      key: 'rec-b.mp4',
      now: dayOne + 60_000,
    })
    expect(second).toEqual({ recorded: false, deduped: true })
    expect(ctx.db.all('growEvents')).toHaveLength(1)

    const nextDay = await callHandler(recordS3SkipWarning, ctx, {
      key: 'rec-c.mp4',
      now: dayOne + 24 * 60 * 60 * 1000,
    })
    expect(nextDay).toEqual({ recorded: true, deduped: false })
    expect(ctx.db.all('growEvents')).toHaveLength(2)
  })

  it('writes a system row the admin console can read', async () => {
    const ctx = createFakeCtx()
    await callHandler(recordS3SkipWarning, ctx, { key: 'rec-a.mp4', now: dayOne })
    const rows = ctx.db.all('growEvents')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      source: 'system',
      entityType: 'automation',
      eventType: 'automation_action_executed',
      title: S3_SKIP_WARNING_TITLE,
    })
    expect(String(rows[0].detail)).toContain('rec-a.mp4')

    // Same shape the admin console reads (growEvents, newest first).
    const recent = await ctx.db.query('growEvents').order('desc').take(10)
    expect(recent.some((event) => event.title === S3_SKIP_WARNING_TITLE)).toBe(true)
  })

  it('does not dedup against unrelated grow events', async () => {
    const ctx: FakeCtx = createFakeCtx()
    await ctx.db.insert('growEvents', {
      source: 'system',
      entityType: 'automation',
      eventType: 'automation_action_executed',
      title: 'some other automation event',
      timestamp: dayOne,
    })
    const res = await callHandler(recordS3SkipWarning, ctx, {
      key: 'rec-a.mp4',
      now: dayOne,
    })
    expect(res.recorded).toBe(true)
    expect(ctx.db.all('growEvents')).toHaveLength(2)
  })
})

describe('deleteRecordingS3Object skip path', () => {
  it('keeps the skip result and records a persistent warning', async () => {
    for (const key of RUSTFS_KEYS) delete process.env[key]
    const ctx = createFakeCtx()
    const runMutation = vi.fn(async (_ref: any, args: any) =>
      callHandler(recordS3SkipWarning, ctx, args),
    )
    const actionCtx = { runMutation } as any

    const first = await (deleteRecordingS3Object as any)._handler(actionCtx, {
      key: 'rec-a.mp4',
    })
    const second = await (deleteRecordingS3Object as any)._handler(actionCtx, {
      key: 'rec-b.mp4',
    })
    expect(first).toEqual({ success: false, skipped: true })
    expect(second).toEqual({ success: false, skipped: true })
    expect(runMutation).toHaveBeenCalledTimes(2)
    // One warning row per day despite repeated skips.
    expect(ctx.db.all('growEvents')).toHaveLength(1)
  })
})
