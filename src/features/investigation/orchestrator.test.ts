import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGraphStore } from '../../graph/graph-store'
import { responseCache } from '../../services/cache/cache'
import { runInvestigation } from './orchestrator'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('runInvestigation', () => {
  beforeEach(() => {
    responseCache.clear()
    useGraphStore.getState().reset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('collects domain DNS and network data in quick mode', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('cloudflare-dns.com') && url.endsWith('type=A')) {
          return Promise.resolve(
            json({
              Status: 0,
              Answer: [{ name: 'example.com.', type: 1, TTL: 300, data: '93.184.216.34' }],
            }),
          )
        }
        if (url.includes('cloudflare-dns.com') && url.includes('type=AAAA')) {
          return Promise.resolve(json({ Status: 0, Answer: [] }))
        }
        if (url.includes('stat.ripe.net/data/network-info')) {
          return Promise.resolve(
            json({
              status: 'ok',
              data: { resource: '93.184.216.34', prefix: '93.184.216.0/24', asns: [15133] },
            }),
          )
        }
        return Promise.resolve(json({}, 404))
      }),
    )

    const controller = new AbortController()
    await runInvestigation(
      { type: 'domain', value: 'example.com', display: 'example.com' },
      'quick',
      controller.signal,
    )

    const state = useGraphStore.getState()
    expect(state.investigation?.status).toBe('complete')
    const nodes = Object.values(state.nodes)
    expect(nodes.some((node) => node.type === 'domain')).toBe(true)
    expect(nodes.some((node) => node.type === 'ip' && node.identifier === '93.184.216.34')).toBe(true)
    expect(nodes.some((node) => node.type === 'prefix' && node.identifier === '93.184.216.0/24')).toBe(true)
    expect(nodes.some((node) => node.type === 'asn' && node.identifier === 'AS15133')).toBe(true)
    expect(Object.values(state.edges).some((edge) => edge.type === 'RESOLVES_TO')).toBe(true)
    expect(Object.values(state.edges).some((edge) => edge.type === 'WITHIN_PREFIX')).toBe(true)
  })

  it('marks an unsupported email input as unknown before the runner is called', async () => {
    const controller = new AbortController()
    await runInvestigation(
      { type: 'unknown', value: '', display: 'not a host', error: 'bad' },
      'quick',
      controller.signal,
    )
    expect(useGraphStore.getState().investigation?.status).toBe('complete')
  })

  it('does not throw when a source fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ error: 'down' }, 503)))
    const controller = new AbortController()
    await runInvestigation(
      { type: 'domain', value: 'example.org', display: 'example.org' },
      'quick',
      controller.signal,
    )
    expect(useGraphStore.getState().investigation?.status).toBe('complete')
    expect(useGraphStore.getState().investigation?.counts.sourcesFailed).toBeGreaterThan(0)
  })
})
