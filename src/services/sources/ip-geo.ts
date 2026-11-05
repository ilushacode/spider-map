import type { SourceResult } from '../../graph/types'
import { ipwhoisGeoSchema, twoIpGeoSchema } from '../../schemas/geo'
import { httpRequest } from '../http/client'

const TWO_IP_URL = 'https://api.2ip.me/geo.json'
const IPWHOIS_URL = 'https://ipwho.is'

export interface GeoInfo {
  ip: string
  country?: string
  countryCode?: string
  region?: string
  city?: string
  latitude?: number
  longitude?: number
  organization?: string
  timezone?: string
  source: '2ip' | 'ipwhois'
  approximate: true
}

function toNumber(value: number | string | undefined): number | undefined {
  if (value === undefined) return undefined
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}

function result<T>(
  sourceId: '2ip' | 'ipwhois',
  status: SourceResult<T>['status'],
  url: string,
  startedAt: number,
  data?: T,
  error?: string,
): SourceResult<T> {
  return {
    sourceId,
    status,
    data,
    error,
    url,
    retrievedAt: new Date().toISOString(),
    durationMs: performance.now() - startedAt,
  }
}

export async function lookup2ip(ip: string, signal?: AbortSignal): Promise<SourceResult<GeoInfo>> {
  const url = `${TWO_IP_URL}?ip=${encodeURIComponent(ip)}`
  const startedAt = performance.now()
  const response = await httpRequest<unknown>(url, {
    signal,
    headers: { Accept: 'application/json' },
    cacheKey: `geo:2ip:${ip}`,
    ttlMs: 24 * 60 * 60_000,
    sourceId: '2ip',
    retries: 0,
  })
  if (!response.ok || !response.data) {
    return result<GeoInfo>('2ip', response.status === 429 ? 'rate-limited' : 'error', url, startedAt, undefined, response.error)
  }
  const parsed = twoIpGeoSchema.safeParse(response.data)
  if (!parsed.success) {
    return result<GeoInfo>('2ip', 'error', url, startedAt, undefined, 'Неожиданный формат ответа 2ip')
  }
  const data = parsed.data
  return result<GeoInfo>('2ip', 'ok', url, startedAt, {
    ip: data.ip ?? ip,
    country: data.country_rus ?? data.country,
    countryCode: data.country_code,
    region: data.region_rus ?? data.region,
    city: data.city_rus ?? data.city,
    latitude: toNumber(data.latitude),
    longitude: toNumber(data.longitude),
    timezone: data.time_zone,
    source: '2ip',
    approximate: true,
  })
}

export async function lookupIpwhois(
  ip: string,
  signal?: AbortSignal,
): Promise<SourceResult<GeoInfo>> {
  const url = `${IPWHOIS_URL}/${encodeURIComponent(ip)}`
  const startedAt = performance.now()
  const response = await httpRequest<unknown>(url, {
    signal,
    headers: { Accept: 'application/json' },
    cacheKey: `geo:ipwhois:${ip}`,
    ttlMs: 24 * 60 * 60_000,
    sourceId: 'ipwhois',
    retries: 0,
  })
  if (!response.ok || !response.data) {
    return result<GeoInfo>('ipwhois', response.status === 429 ? 'rate-limited' : 'error', url, startedAt, undefined, response.error)
  }
  const parsed = ipwhoisGeoSchema.safeParse(response.data)
  if (!parsed.success) {
    return result<GeoInfo>('ipwhois', 'error', url, startedAt, undefined, 'Неожиданный формат ответа ipwho.is')
  }
  const data = parsed.data
  if (data.success === false) {
    return result<GeoInfo>('ipwhois', 'error', url, startedAt, undefined, 'ipwho.is не нашёл данные')
  }
  return result<GeoInfo>('ipwhois', 'ok', url, startedAt, {
    ip: data.ip ?? ip,
    country: data.country,
    countryCode: data.country_code,
    region: data.region,
    city: data.city,
    latitude: data.latitude,
    longitude: data.longitude,
    organization: data.connection?.org ?? data.connection?.isp,
    timezone: data.timezone?.id,
    source: 'ipwhois',
    approximate: true,
  })
}

export interface GeoLookup {
  result: SourceResult<GeoInfo>
  attempts: SourceResult<unknown>[]
}

export async function lookupGeoPreferred(ip: string, signal?: AbortSignal): Promise<GeoLookup> {
  const twoIp = await lookup2ip(ip, signal)
  if (twoIp.status === 'ok') return { result: twoIp, attempts: [twoIp] }
  if (signal?.aborted) return { result: twoIp, attempts: [twoIp] }
  const fallback = await lookupIpwhois(ip, signal)
  return { result: fallback, attempts: [twoIp, fallback] }
}
