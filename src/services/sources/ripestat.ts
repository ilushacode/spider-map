import type { SourceResult } from '../../graph/types'
import {
  abuseContactFinderSchema,
  announcedPrefixesSchema,
  asOverviewSchema,
  lookingGlassSchema,
  networkInfoSchema,
  prefixCountSchema,
  prefixOverviewSchema,
  ripestatEnvelopeSchema,
  routingHistorySchema,
  rpkiValidationSchema,
} from '../../schemas/ripestat'
import { httpRequest } from '../http/client'

const BASE_URL = 'https://stat.ripe.net/data'
const SOURCE_ID = 'ripestat' as const
const TTL_MS = 15 * 60_000

export interface NetworkInfo {
  resource: string
  prefix: string | null
  asns: number[]
}

export interface AsOverview {
  resource: string
  holder?: string
  announced?: boolean
  block?: { resource?: string; desc?: string; name?: string }
}

export interface AnnouncedPrefixes {
  resource: string
  prefixes: string[]
}

export interface PrefixOverview {
  resource: string
  announced?: boolean
  asns: Array<{ asn: number; holder?: string }>
  relatedPrefixes: string[]
}

export interface LookingGlass {
  resource: string
  collectors: Array<{
    rrc?: string
    location?: string
    peers: Array<{
      asnOrigin?: number
      asPath?: string
      nextHop?: string
      lastUpdated?: string
    }>
  }>
}

export interface RpkiValidation {
  resource: string
  prefix?: string
  status: string
  validatingRoas: number
}

export interface AbuseContact {
  resource: string
  contacts: string[]
  authorities: string[]
}

export interface RoutingHistory {
  resource: string
  origins: Array<{ origin: number; prefixes: string[] }>
}

export interface PrefixCount {
  resource: string
  series: Array<{ starttime?: string; endtime?: string; v4?: number; v6?: number }>
}

function stripData<T>(result: SourceResult<unknown>): SourceResult<T> {
  return {
    sourceId: result.sourceId,
    status: result.status,
    error: result.error,
    url: result.url,
    retrievedAt: result.retrievedAt,
    durationMs: result.durationMs,
  }
}

async function ripestatRequest<T>(
  endpoint: string,
  params: Record<string, string>,
  schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false } },
  signal?: AbortSignal,
): Promise<SourceResult<T>> {
  const search = new URLSearchParams({ ...params, sourceapp: 'spider-map' })
  const url = `${BASE_URL}/${endpoint}/data.json?${search.toString()}`
  const startedAt = performance.now()
  const response = await httpRequest<unknown>(url, {
    signal,
    cacheKey: `ripestat:${endpoint}:${search.toString()}`,
    ttlMs: TTL_MS,
    sourceId: SOURCE_ID,
  })

  if (!response.ok || !response.data) {
    return {
      sourceId: SOURCE_ID,
      status: response.error === 'Запрос отменён' ? 'cancelled' : 'error',
      error: response.error,
      url,
      retrievedAt: new Date().toISOString(),
      durationMs: performance.now() - startedAt,
    }
  }

  const envelope = ripestatEnvelopeSchema.safeParse(response.data)
  if (!envelope.success) {
    return {
      sourceId: SOURCE_ID,
      status: 'error',
      error: 'Неожиданный формат ответа RIPEstat',
      url,
      retrievedAt: new Date().toISOString(),
      durationMs: performance.now() - startedAt,
    }
  }

  if (envelope.data.status !== 'ok') {
    return {
      sourceId: SOURCE_ID,
      status: 'error',
      error: envelope.data.message ?? `RIPEstat: ${envelope.data.status}`,
      url,
      retrievedAt: new Date().toISOString(),
      durationMs: performance.now() - startedAt,
    }
  }

  const parsed = schema.safeParse(envelope.data.data)
  if (!parsed.success) {
    return {
      sourceId: SOURCE_ID,
      status: 'error',
      error: 'Неожиданная структура данных RIPEstat',
      url,
      retrievedAt: new Date().toISOString(),
      durationMs: performance.now() - startedAt,
    }
  }

  return {
    sourceId: SOURCE_ID,
    status: 'ok',
    data: parsed.data,
    url,
    retrievedAt: new Date().toISOString(),
    durationMs: performance.now() - startedAt,
  }
}

export async function fetchNetworkInfo(
  resource: string,
  signal?: AbortSignal,
): Promise<SourceResult<NetworkInfo>> {
  const result = await ripestatRequest('network-info', { resource }, networkInfoSchema, signal)
  if (!result.data) return stripData(result)
  return {
    ...result,
    data: {
      resource: result.data.resource ?? resource,
      prefix: result.data.prefix ?? null,
      asns: (result.data.asns ?? [])
        .map((value) => Number(value))
        .filter((value) => Number.isSafeInteger(value) && value > 0),
    },
  }
}

export async function fetchAsOverview(
  asn: string,
  signal?: AbortSignal,
): Promise<SourceResult<AsOverview>> {
  const result = await ripestatRequest('as-overview', { resource: asn }, asOverviewSchema, signal)
  if (!result.data) return stripData(result)
  return {
    ...result,
    data: {
      resource: result.data.resource ?? asn,
      holder: result.data.holder,
      announced: result.data.announced,
      block: result.data.block,
    },
  }
}

export async function fetchAnnouncedPrefixes(
  asn: string,
  signal?: AbortSignal,
): Promise<SourceResult<AnnouncedPrefixes>> {
  const result = await ripestatRequest(
    'announced-prefixes',
    { resource: asn },
    announcedPrefixesSchema,
    signal,
  )
  if (!result.data) return stripData(result)
  return {
    ...result,
    data: {
      resource: result.data.resource ?? asn,
      prefixes: (result.data.prefixes ?? []).map((item) => item.prefix),
    },
  }
}

export async function fetchPrefixOverview(
  prefix: string,
  signal?: AbortSignal,
): Promise<SourceResult<PrefixOverview>> {
  const result = await ripestatRequest(
    'prefix-overview',
    { resource: prefix },
    prefixOverviewSchema,
    signal,
  )
  if (!result.data) return stripData(result)
  return {
    ...result,
    data: {
      resource: result.data.resource ?? prefix,
      announced: result.data.announced,
      asns: (result.data.asns ?? []).map((item) => ({ asn: item.asn, holder: item.holder })),
      relatedPrefixes: (result.data.related_prefixes ?? [])
        .map((item) => (typeof item === 'string' ? item : undefined))
        .filter((item): item is string => Boolean(item)),
    },
  }
}

export async function fetchLookingGlass(
  resource: string,
  signal?: AbortSignal,
): Promise<SourceResult<LookingGlass>> {
  const result = await ripestatRequest('looking-glass', { resource }, lookingGlassSchema, signal)
  if (!result.data) return stripData(result)
  return {
    ...result,
    data: {
      resource: result.data.resource ?? resource,
      collectors: (result.data.rrcs ?? []).map((rrc) => ({
        rrc: rrc.rrc,
        location: rrc.location,
        peers: (rrc.peers ?? []).map((peer) => ({
          asnOrigin: peer.asn_origin === undefined ? undefined : Number(peer.asn_origin),
          asPath: peer.as_path,
          nextHop: peer.next_hop,
          lastUpdated: peer.last_updated,
        })),
      })),
    },
  }
}

export async function fetchRpkiValidation(
  asn: string,
  prefix: string,
  signal?: AbortSignal,
): Promise<SourceResult<RpkiValidation>> {
  const result = await ripestatRequest(
    'rpki-validation',
    { resource: asn, prefix },
    rpkiValidationSchema,
    signal,
  )
  if (!result.data) return stripData(result)
  return {
    ...result,
    data: {
      resource: result.data.resource ?? asn,
      prefix: result.data.prefix ?? prefix,
      status: result.data.status ?? 'unknown',
      validatingRoas: result.data.validating_roas?.length ?? 0,
    },
  }
}

export async function fetchAbuseContact(
  resource: string,
  signal?: AbortSignal,
): Promise<SourceResult<AbuseContact>> {
  const result = await ripestatRequest(
    'abuse-contact-finder',
    { resource },
    abuseContactFinderSchema,
    signal,
  )
  if (!result.data) return stripData(result)
  return {
    ...result,
    data: {
      resource: result.data.resource ?? resource,
      contacts: result.data.abuse_contacts ?? [],
      authorities: result.data.authorities ?? [],
    },
  }
}

export async function fetchRoutingHistory(
  resource: string,
  signal?: AbortSignal,
): Promise<SourceResult<RoutingHistory>> {
  const result = await ripestatRequest(
    'routing-history',
    { resource, max_rows: '50' },
    routingHistorySchema,
    signal,
  )
  if (!result.data) return stripData(result)
  return {
    ...result,
    data: {
      resource: result.data.resource ?? resource,
      origins: (result.data.by_origin ?? []).map((origin) => ({
        origin: origin.origin ?? 0,
        prefixes: (origin.prefixes ?? []).map((item) => item.prefix),
      })),
    },
  }
}

export async function fetchPrefixCount(
  asn: string,
  signal?: AbortSignal,
): Promise<SourceResult<PrefixCount>> {
  const result = await ripestatRequest('prefix-count', { resource: asn }, prefixCountSchema, signal)
  if (!result.data) return stripData(result)
  const series = new Map<string, { starttime?: string; endtime?: string; v4?: number; v6?: number }>()
  for (const point of result.data.ipv4 ?? []) {
    if (!point.timestamp) continue
    series.set(point.timestamp, { starttime: point.timestamp, v4: point.prefixes })
  }
  for (const point of result.data.ipv6 ?? []) {
    if (!point.timestamp) continue
    const current = series.get(point.timestamp) ?? { starttime: point.timestamp }
    series.set(point.timestamp, { ...current, v6: point.prefixes })
  }
  return {
    ...result,
    data: {
      resource: result.data.resource ?? asn,
      series: [...series.values()].sort((a, b) =>
        (a.starttime ?? '').localeCompare(b.starttime ?? ''),
      ),
    },
  }
}
