import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { responseCache } from '../cache/cache'
import { lookup2ip, lookupGeoPreferred } from './ip-geo'
import { queryYandexDns, resetYandexDnsAvailability } from './yandex-dns'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('Russian-first geo sources', () => {
  beforeEach(() => {
    responseCache.clear()
    resetYandexDnsAvailability()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('uses 2ip first', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        json({
          ip: '1.1.1.1',
          country_code: 'AU',
          country: 'Australia',
          country_rus: 'Австралия',
          city: 'Brisbane',
          city_rus: 'Брисбен',
          latitude: '-27.4679',
          longitude: '153.0281',
        }),
      ),
    )
    const result = await lookup2ip('1.1.1.1')
    expect(result.status).toBe('ok')
    expect(result.data?.country).toBe('Австралия')
    expect(result.data?.source).toBe('2ip')
  })

  it('falls back to ipwho.is when 2ip is rate limited', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('api.2ip.me')) return Promise.resolve(json({ error: 'limit' }, 429))
        return Promise.resolve(
          json({
            ip: '1.1.1.1',
            success: true,
            country: 'Australia',
            country_code: 'AU',
            city: 'Brisbane',
            latitude: -27.4679,
            longitude: 153.0281,
            connection: { org: 'Cloudflare' },
          }),
        )
      }),
    )
    const result = await lookupGeoPreferred('1.1.1.1')
    expect(result.result.status).toBe('ok')
    expect(result.result.data?.source).toBe('ipwhois')
    expect(result.attempts).toHaveLength(2)
  })

  it('does not hammer Yandex DNS after a failure', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ error: 'blocked' }, 429))
    vi.stubGlobal('fetch', fetchMock)
    const first = await queryYandexDns('example.com', 'A')
    expect(first.status).toBe('error')
    const second = await queryYandexDns('example.com', 'A')
    expect(second.status).toBe('unsupported')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
