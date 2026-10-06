import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('#app', () => ({
  tryUseNuxtApp: () => null,
  useRuntimeConfig: () => ({ public: {} }),
}))

import { renderMarkdown } from '../../../app/utils/markdown'
import { getImageUrl } from '../../../app/utils/images'
import {
  buildImageUrl,
  DEFAULT_IMAGE_BASE_URL,
  DEFAULT_IMAGE_BUCKET,
} from '../../../shared/utils/images'

describe('renderMarkdown', () => {
  it('renders basic markdown elements', () => {
    expect(renderMarkdown('# Title')).toContain('<h1')
    expect(renderMarkdown('**bold**')).toContain('<strong>bold</strong>')
    expect(renderMarkdown('*italic*')).toContain('<em>italic</em>')
    expect(renderMarkdown('`code`')).toContain('<code>code</code>')
    expect(renderMarkdown('- a\n- b')).toContain('<li>')
  })

  it('keeps safe links', () => {
    const html = renderMarkdown('[growmate](https://growmate.bond)')
    expect(html).toContain('<a href="https://growmate.bond"')
  })

  it('strips script tags and their contents', () => {
    const html = renderMarkdown('<script>alert("xss")</script>hello')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('alert')
    expect(html).toContain('hello')
  })

  it('strips event-handler attributes but keeps the element', () => {
    const html = renderMarkdown('<div onclick="alert(1)">hi</div>')
    expect(html).toContain('hi')
    expect(html).not.toContain('onclick')
    expect(html).not.toContain('alert')
  })

  it('strips onerror handlers from images but keeps the src', () => {
    const html = renderMarkdown('<img src="https://example.com/a.png" onerror="alert(1)">')
    expect(html).toContain('<img')
    expect(html).toContain('https://example.com/a.png')
    expect(html).not.toContain('onerror')
  })

  it('neutralizes javascript: link targets', () => {
    const html = renderMarkdown('[click](javascript:alert(1))')
    expect(html).not.toContain('javascript:')
  })

  it('returns an empty string for empty input', () => {
    expect(renderMarkdown('')).toBe('')
  })
})

describe('getImageUrl', () => {
  const ENV_BASE = 'NUXT_PUBLIC_MINIO_BASE_URL'
  const ENV_BUCKET = 'NUXT_PUBLIC_MINIO_BUCKET_IMAGE'
  let savedBase: string | undefined
  let savedBucket: string | undefined

  beforeEach(() => {
    savedBase = process.env[ENV_BASE]
    savedBucket = process.env[ENV_BUCKET]
    delete process.env[ENV_BASE]
    delete process.env[ENV_BUCKET]
  })

  afterEach(() => {
    if (savedBase === undefined) delete process.env[ENV_BASE]
    else process.env[ENV_BASE] = savedBase
    if (savedBucket === undefined) delete process.env[ENV_BUCKET]
    else process.env[ENV_BUCKET] = savedBucket
  })

  it('returns null for nullish or empty paths', () => {
    expect(getImageUrl(null)).toBeNull()
    expect(getImageUrl(undefined)).toBeNull()
    expect(getImageUrl('')).toBeNull()
  })

  it('builds the default URL with size 400', () => {
    expect(getImageUrl('foo/bar.jpg')).toBe(
      `${DEFAULT_IMAGE_BASE_URL}/${DEFAULT_IMAGE_BUCKET}/foo/bar.jpg/400w.webp`,
    )
  })

  it('honors the size argument', () => {
    expect(getImageUrl('foo/bar.jpg', 200)).toBe(
      `${DEFAULT_IMAGE_BASE_URL}/${DEFAULT_IMAGE_BUCKET}/foo/bar.jpg/200w.webp`,
    )
  })

  it('honors base-URL and bucket env overrides', () => {
    process.env[ENV_BASE] = 'https://cdn.example.com'
    process.env[ENV_BUCKET] = 'photos'
    expect(getImageUrl('foo/bar.jpg')).toBe('https://cdn.example.com/photos/foo/bar.jpg/400w.webp')
  })
})

describe('buildImageUrl', () => {
  it('joins base, bucket, path, and size variant', () => {
    expect(buildImageUrl('p.jpg', 100, 'https://b', 'bucket')).toBe(
      'https://b/bucket/p.jpg/100w.webp',
    )
  })

  it('exposes the expected defaults', () => {
    expect(DEFAULT_IMAGE_BASE_URL).toBe('https://storage.growmate.bond')
    expect(DEFAULT_IMAGE_BUCKET).toBe('images')
  })
})
