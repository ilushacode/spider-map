import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { responseCache } from '../cache/cache'
import { searchCertificates } from './certificate-transparency'
import { queryCloudflareDns } from './cloudflare-dns'
import { queryGoogleDns } from './google-dns'
import { lookupAsn, lookupDomain, lookupIp, resetRdapBootstrapCache } from './rdap'
import { fetchNetworkInfo, fetchPrefixCount } from './ripestat'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('DNS adapters', () => {
  beforeEach(() => responseCache.clear())
  afterEach(() => vi.unstubAllGlobals())

  it('normalizes Cloudflare DNS answers', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        json({
          Status: 0,
          Answer: [
            { name: 'example.com.', type: 1, TTL: 300, data: '93.184.216.34' },
            { name: 'example.com.', type: 28, TTL: 300, data: '2606:2800:220:1::' },
          ],
        }),
      ),
    )
    const result = await queryCloudflareDns('example.com', 'A')
    expect(result.status).toBe('ok')
    expect(result.data?.records).toHaveLength(2)
    expect(result.data?.records[0]).toEqual({
      name: 'example.com',
      type: 'A',
      ttl: 300,
      data: '93.184.216.34',
    })
  })

  it('keeps NXDOMAIN as an empty result rather than an error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ Status: 3 })))
    const result = await queryGoogleDns('missing.example', 'A')
    expect(result.status).toBe('ok')
    expect(result.data?.status).toBe(3)
    expect(result.data?.records).toEqual([])
  })

  it('rejects malformed DNS responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ unexpected: true })))
    const result = await queryCloudflareDns('example.com', 'A')
    expect(result.status).toBe('error')
  })
})

describe('RIPEstat adapter', () => {
  beforeEach(() => responseCache.clear())
  afterEach(() => vi.unstubAllGlobals())

  it('normalizes network-info string ASNs', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        json({
          status: 'ok',
          data: { resource: '1.1.1.1', prefix: '1.1.1.0/24', asns: ['13335'] },
        }),
      ),
    )
    const result = await fetchNetworkInfo('1.1.1.1')
    expect(result.status).toBe('ok')
    expect(result.data).toEqual({ resource: '1.1.1.1', prefix: '1.1.1.0/24', asns: [13335] })
  })

  it('normalizes prefix-count series', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        json({
          status: 'ok',
          data: {
            resource: '13335',
            ipv4: [{ prefixes: 10, timestamp: '2024-01-01', 'address-space': 0 }],
            ipv6: [{ prefixes: 4, timestamp: '2024-01-01', 'address-space': 0 }],
          },
        }),
      ),
    )
    const result = await fetchPrefixCount('AS13335')
    expect(result.data?.series[0]).toEqual({ starttime: '2024-01-01', v4: 10, v6: 4 })
  })

  it('surfaces RIPEstat error envelopes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(json({ status: 'error', message: 'Invalid resource' })),
    )
    const result = await fetchNetworkInfo('bad')
    expect(result.status).toBe('error')
    expect(result.error).toBe('Invalid resource')
  })
})

describe('RDAP adapter', () => {
  beforeEach(() => {
    responseCache.clear()
    resetRdapBootstrapCache()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('selects a domain server from IANA bootstrap', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('data.iana.org/rdap/dns.json')) {
          return Promise.resolve(
            json({ services: [[['com'], ['https://rdap.verisign.com/com/v1/']]] }),
          )
        }
        if (url.includes('example.com')) {
          return Promise.resolve(
            json({
              objectClassName: 'domain',
              handle: '2336799_DOMAIN_COM-VRSN',
              ldhName: 'example.com',
              status: ['active'],
              events: [{ eventAction: 'registration', eventDate: '1995-08-14T04:00:00Z' }],
              nameservers: [{ ldhName: 'a.iana-servers.net' }],
              entities: [
                {
                  handle: '376',
                  roles: ['registrar'],
                  vcardArray: ['vcard', [['fn', {}, 'text', 'IANA Registrar']]],
                },
              ],
            }),
          )
        }
        return Promise.resolve(json({}, 404))
      }),
    )
    const result = await lookupDomain('example.com')
    expect(result.status).toBe('ok')
    expect(result.data?.nameservers).toEqual(['a.iana-servers.net'])
    expect(result.data?.events[0].action).toBe('registration')
    expect(result.data?.entities[0].name).toBe('IANA Registrar')
  })

  it('matches the most specific IPv4 bootstrap range', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('ipv4.json')) {
          return Promise.resolve(
            json({
              services: [
                [['1.0.0.0/8'], ['https://rdap.apnic.net/']],
                [['1.1.1.0/24'], ['https://rdap.arin.net/registry/']],
              ],
            }),
          )
        }
        return Promise.resolve(json({ objectClassName: 'ip network', startAddress: '1.1.1.0' }))
      }),
    )
    const result = await lookupIp('1.1.1.1')
    expect(result.status).toBe('ok')
    expect(result.data?.server).toBe('https://rdap.arin.net/registry/')
  })

  it('selects an ASN server', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('asn.json')) {
          return Promise.resolve(
            json({ services: [[['13335'], ['https://rdap.arin.net/registry/']]] }),
          )
        }
        return Promise.resolve(
          json({ objectClassName: 'autnum', handle: 'AS13335', startAutnum: 13335, endAutnum: 13335 }),
        )
      }),
    )
    const result = await lookupAsn('AS13335')
    expect(result.status).toBe('ok')
    expect(result.data?.startAutnum).toBe(13335)
  })
})

describe('Certificate Transparency adapter', () => {
  beforeEach(() => responseCache.clear())
  afterEach(() => vi.unstubAllGlobals())

  it('normalizes certificate names', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        json([
          {
            id: 1,
            common_name: 'example.com',
            name_value: 'example.com\nwww.example.com\nexample.com',
            issuer_name: 'Test CA',
            not_before: '2024-01-01',
            not_after: '2024-12-31',
          },
        ]),
      ),
    )
    const result = await searchCertificates('example.com')
    expect(result.status).toBe('ok')
    expect(result.data?.certificates[0].names).toEqual(['example.com', 'www.example.com'])
  })

  it('reports crt.sh unavailability without throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ error: 'bad gateway' }, 502)))
    const result = await searchCertificates('example.com')
    expect(result.status).toBe('error')
  })
})
