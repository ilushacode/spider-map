import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { responseCache } from '../cache/cache'
import { httpRequest } from './client'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('httpRequest', () => {
  beforeEach(() => {
    responseCache.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('rejects hosts outside the allowlist', async () => {
    const result = await httpRequest('https://evil.example/data')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('allowlist')
  })

  it('parses JSON from an allowed host', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ answer: 42 })))
    const result = await httpRequest<{ answer: number }>('https://dns.google/resolve?name=example.com')
    expect(result.ok).toBe(true)
    expect(result.data?.answer).toBe(42)
  })

  it('returns an error for invalid JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not json', { status: 200 })))
    const result = await httpRequest('https://dns.google/resolve?name=example.com')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('JSON')
  })

  it('serves cached responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ value: 1 }))
    vi.stubGlobal('fetch', fetchMock)
    const options = {
      cacheKey: 'test-cache',
      ttlMs: 60_000,
      sourceId: 'google-dns' as const,
    }
    const first = await httpRequest('https://dns.google/resolve?name=example.com', options)
    const second = await httpRequest('https://dns.google/resolve?name=example.com', options)
    expect(first.fromCache).toBe(false)
    expect(second.fromCache).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('deduplicates identical in-flight requests', async () => {
    let resolveFetch: (value: Response) => void = () => undefined
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve
        }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const first = httpRequest('https://dns.google/resolve?name=dedupe.example')
    const second = httpRequest('https://dns.google/resolve?name=dedupe.example')
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    resolveFetch(jsonResponse({ ok: true }))
    const [a, b] = await Promise.all([first, second])
    expect(a.ok).toBe(true)
    expect(b.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retries retryable statuses', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'rate limited' }, 429))
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)
    const result = await httpRequest('https://dns.google/resolve?name=retry.example', { retries: 1 })
    expect(result.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not retry permanent errors', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: 'forbidden' }, 403))
    vi.stubGlobal('fetch', fetchMock)
    const result = await httpRequest('https://dns.google/resolve?name=forbidden.example')
    expect(result.ok).toBe(false)
    expect(result.status).toBe(403)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
