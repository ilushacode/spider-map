import type { SourceResult } from '../../graph/types'
import {
  rdapAutnumSchema,
  rdapBootstrapSchema,
  rdapDomainSchema,
  rdapIpSchema,
} from '../../schemas/rdap'
import { httpRequest } from '../http/client'
import { registerAllowedHost } from '../http/allowlist'

const SOURCE_ID = 'rdap' as const
const BOOTSTRAP_TTL_MS = 24 * 60 * 60_000
const LOOKUP_TTL_MS = 6 * 60 * 60_000

export interface RdapEntity {
  handle?: string
  roles: string[]
  name?: string
  organization?: string
  email?: string
  url?: string
}

export interface RdapEvent {
  action: string
  date?: string
}

export interface RdapResult {
  kind: 'domain' | 'ip' | 'autnum'
  handle?: string
  name?: string
  status: string[]
  events: RdapEvent[]
  nameservers: string[]
  entities: RdapEntity[]
  startAddress?: string
  endAddress?: string
  ipVersion?: string
  country?: string
  startAutnum?: number
  endAutnum?: number
  server: string
  url: string
}

interface BootstrapService {
  ranges: string[]
  urls: string[]
}

const bootstrapCache = new Map<string, BootstrapService[]>()

export function resetRdapBootstrapCache(): void {
  bootstrapCache.clear()
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  let value = 0
  for (const part of parts) {
    const number = Number(part)
    if (!Number.isInteger(number) || number < 0 || number > 255) return null
    value = value * 256 + number
  }
  return value >>> 0
}

function ipv6ToBigInt(ip: string): bigint | null {
  const value = ip.toLowerCase()
  const halves = value.split('::')
  if (halves.length > 2) return null
  const head = halves[0] ? halves[0].split(':') : []
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : []
  let parts: string[]
  if (halves.length === 2) {
    const missing = 8 - head.length - tail.length
    if (missing < 0) return null
    parts = [...head, ...Array<string>(missing).fill('0'), ...tail]
  } else {
    parts = head
  }
  if (parts.length !== 8) return null
  let result = 0n
  for (const part of parts) {
    if (!/^[0-9a-f]{1,4}$/.test(part)) return null
    result = (result << 16n) + BigInt(parseInt(part, 16))
  }
  return result
}

function cidrContains(cidr: string, ip: string): boolean {
  const [network, prefixPart] = cidr.split('/')
  const prefix = Number(prefixPart)
  if (!network || !Number.isInteger(prefix)) return false
  if (network.includes(':')) {
    const net = ipv6ToBigInt(network)
    const addr = ipv6ToBigInt(ip)
    if (net === null || addr === null || prefix < 0 || prefix > 128) return false
    const shift = BigInt(128 - prefix)
    return net >> shift === addr >> shift
  }
  const net = ipv4ToInt(network)
  const addr = ipv4ToInt(ip)
  if (net === null || addr === null || prefix < 0 || prefix > 32) return false
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0
  return (net & mask) === (addr & mask)
}

function asnInRange(range: string, asn: number): boolean {
  const [startPart, endPart] = range.split('-')
  const start = Number(startPart)
  const end = endPart ? Number(endPart) : start
  if (!Number.isInteger(start) || !Number.isInteger(end)) return false
  return asn >= start && asn <= end
}

async function loadBootstrap(kind: 'dns' | 'ipv4' | 'ipv6' | 'asn', signal?: AbortSignal) {
  const cached = bootstrapCache.get(kind)
  if (cached) return cached

  const url = `https://data.iana.org/rdap/${kind}.json`
  const response = await httpRequest<unknown>(url, {
    signal,
    cacheKey: `rdap:bootstrap:${kind}`,
    ttlMs: BOOTSTRAP_TTL_MS,
    sourceId: SOURCE_ID,
  })
  if (!response.ok || !response.data) return null

  const parsed = rdapBootstrapSchema.safeParse(response.data)
  if (!parsed.success) return null

  const services: BootstrapService[] = parsed.data.services.map(([ranges, urls]) => {
    for (const raw of urls) {
      try {
        registerAllowedHost(new URL(raw).hostname)
      } catch {
        // Ignore malformed bootstrap URLs.
      }
    }
    return { ranges, urls }
  })
  bootstrapCache.set(kind, services)
  return services
}

function pickServer(services: BootstrapService[]): string | null {
  for (const service of services) {
    const url = service.urls.find((item) => item.startsWith('https://'))
    if (url) return url.endsWith('/') ? url : `${url}/`
  }
  return null
}

async function findDomainServer(domain: string, signal?: AbortSignal): Promise<string | null> {
  const services = await loadBootstrap('dns', signal)
  if (!services) return null
  const tld = domain.split('.').pop()?.toLowerCase()
  if (!tld) return null
  const matches = services.filter((service) =>
    service.ranges.some((range) => range.toLowerCase() === tld),
  )
  return pickServer(matches)
}

async function findIpServer(ip: string, signal?: AbortSignal): Promise<string | null> {
  const kind = ip.includes(':') ? 'ipv6' : 'ipv4'
  const services = await loadBootstrap(kind, signal)
  if (!services) return null
  let best: { service: BootstrapService; prefix: number } | null = null
  for (const service of services) {
    for (const range of service.ranges) {
      if (!cidrContains(range, ip)) continue
      const prefix = Number(range.split('/')[1] ?? '0')
      if (!best || prefix > best.prefix) best = { service, prefix }
    }
  }
  return best ? pickServer([best.service]) : null
}

async function findAsnServer(asn: number, signal?: AbortSignal): Promise<string | null> {
  const services = await loadBootstrap('asn', signal)
  if (!services) return null
  const matches = services.filter((service) =>
    service.ranges.some((range) => asnInRange(range, asn)),
  )
  return pickServer(matches)
}

function extractVcard(entity: {
  vcardArray?: unknown[]
  handle?: string
  roles?: string[]
  links?: Array<{ href?: string }>
}): RdapEntity {
  const result: RdapEntity = {
    handle: entity.handle,
    roles: entity.roles ?? [],
    url: entity.links?.find((link) => link.href)?.href,
  }
  const vcard = entity.vcardArray
  if (Array.isArray(vcard) && Array.isArray(vcard[1])) {
    for (const field of vcard[1]) {
      if (!Array.isArray(field) || field.length < 4) continue
      const [name, , , value] = field
      if (typeof value !== 'string') continue
      if (name === 'fn') result.name = value
      if (name === 'org') result.organization = value
      if (name === 'email') result.email = value
    }
  }
  return result
}

function normalizeEvents(events?: Array<{ eventAction: string; eventDate?: string }>): RdapEvent[] {
  return (events ?? []).map((event) => ({ action: event.eventAction, date: event.eventDate }))
}

function normalizeEntities(
  entities?: Array<{
    handle?: string
    roles?: string[]
    vcardArray?: unknown[]
    links?: Array<{ href?: string }>
  }>,
): RdapEntity[] {
  return (entities ?? []).map(extractVcard)
}

function errorResult(url: string, error: string, startedAt: number): SourceResult<RdapResult> {
  return {
    sourceId: SOURCE_ID,
    status: error === 'Запрос отменён' ? 'cancelled' : 'error',
    error,
    url,
    retrievedAt: new Date().toISOString(),
    durationMs: performance.now() - startedAt,
  }
}

export async function lookupDomain(
  domain: string,
  signal?: AbortSignal,
): Promise<SourceResult<RdapResult>> {
  const startedAt = performance.now()
  const server = await findDomainServer(domain, signal)
  if (!server) {
    return {
      sourceId: SOURCE_ID,
      status: 'unsupported',
      error: 'Нет RDAP-сервера для этого домена',
      url: 'https://data.iana.org/rdap/dns.json',
      retrievedAt: new Date().toISOString(),
      durationMs: performance.now() - startedAt,
    }
  }
  const url = `${server}domain/${encodeURIComponent(domain)}`
  const response = await httpRequest<unknown>(url, {
    signal,
    headers: { Accept: 'application/rdap+json' },
    cacheKey: `rdap:domain:${domain}`,
    ttlMs: LOOKUP_TTL_MS,
    sourceId: SOURCE_ID,
  })
  if (!response.ok || !response.data) return errorResult(url, response.error ?? 'Нет ответа', startedAt)

  const parsed = rdapDomainSchema.safeParse(response.data)
  if (!parsed.success) return errorResult(url, 'Неожиданный формат RDAP-ответа', startedAt)

  return {
    sourceId: SOURCE_ID,
    status: 'ok',
    data: {
      kind: 'domain',
      handle: parsed.data.handle,
      name: parsed.data.ldhName ?? parsed.data.unicodeName,
      status: parsed.data.status ?? [],
      events: normalizeEvents(parsed.data.events),
      nameservers: (parsed.data.nameservers ?? [])
        .map((item) => item.ldhName)
        .filter((item): item is string => Boolean(item)),
      entities: normalizeEntities(parsed.data.entities),
      server,
      url,
    },
    url,
    retrievedAt: new Date().toISOString(),
    durationMs: performance.now() - startedAt,
  }
}

export async function lookupIp(ip: string, signal?: AbortSignal): Promise<SourceResult<RdapResult>> {
  const startedAt = performance.now()
  const server = await findIpServer(ip, signal)
  if (!server) {
    return {
      sourceId: SOURCE_ID,
      status: 'unsupported',
      error: 'Нет RDAP-сервера для этого IP',
      url: 'https://data.iana.org/rdap/ipv4.json',
      retrievedAt: new Date().toISOString(),
      durationMs: performance.now() - startedAt,
    }
  }
  const url = `${server}ip/${encodeURIComponent(ip)}`
  const response = await httpRequest<unknown>(url, {
    signal,
    headers: { Accept: 'application/rdap+json' },
    cacheKey: `rdap:ip:${ip}`,
    ttlMs: LOOKUP_TTL_MS,
    sourceId: SOURCE_ID,
  })
  if (!response.ok || !response.data) return errorResult(url, response.error ?? 'Нет ответа', startedAt)

  const parsed = rdapIpSchema.safeParse(response.data)
  if (!parsed.success) return errorResult(url, 'Неожиданный формат RDAP-ответа', startedAt)

  return {
    sourceId: SOURCE_ID,
    status: 'ok',
    data: {
      kind: 'ip',
      handle: parsed.data.handle,
      name: parsed.data.name,
      status: parsed.data.status ?? [],
      events: normalizeEvents(parsed.data.events),
      nameservers: [],
      entities: normalizeEntities(parsed.data.entities),
      startAddress: parsed.data.startAddress,
      endAddress: parsed.data.endAddress,
      ipVersion: parsed.data.ipVersion,
      country: parsed.data.country,
      server,
      url,
    },
    url,
    retrievedAt: new Date().toISOString(),
    durationMs: performance.now() - startedAt,
  }
}

export async function lookupAsn(
  asn: string,
  signal?: AbortSignal,
): Promise<SourceResult<RdapResult>> {
  const startedAt = performance.now()
  const number = Number(asn.replace(/^AS/i, ''))
  const server = await findAsnServer(number, signal)
  if (!server) {
    return {
      sourceId: SOURCE_ID,
      status: 'unsupported',
      error: 'Нет RDAP-сервера для этого ASN',
      url: 'https://data.iana.org/rdap/asn.json',
      retrievedAt: new Date().toISOString(),
      durationMs: performance.now() - startedAt,
    }
  }
  const url = `${server}autnum/${number}`
  const response = await httpRequest<unknown>(url, {
    signal,
    headers: { Accept: 'application/rdap+json' },
    cacheKey: `rdap:asn:${number}`,
    ttlMs: LOOKUP_TTL_MS,
    sourceId: SOURCE_ID,
  })
  if (!response.ok || !response.data) return errorResult(url, response.error ?? 'Нет ответа', startedAt)

  const parsed = rdapAutnumSchema.safeParse(response.data)
  if (!parsed.success) return errorResult(url, 'Неожиданный формат RDAP-ответа', startedAt)

  return {
    sourceId: SOURCE_ID,
    status: 'ok',
    data: {
      kind: 'autnum',
      handle: parsed.data.handle,
      name: parsed.data.name,
      status: parsed.data.status ?? [],
      events: normalizeEvents(parsed.data.events),
      nameservers: [],
      entities: normalizeEntities(parsed.data.entities),
      startAutnum: parsed.data.startAutnum,
      endAutnum: parsed.data.endAutnum,
      server,
      url,
    },
    url,
    retrievedAt: new Date().toISOString(),
    durationMs: performance.now() - startedAt,
  }
}
