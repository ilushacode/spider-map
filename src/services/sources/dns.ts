import type { SourceId, SourceResult } from '../../graph/types'
import { dnsResponseSchema } from '../../schemas/dns'
import { httpRequest } from '../http/client'

export const DNS_TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'NS', 'TXT', 'SOA', 'CAA', 'SRV'] as const

export type DnsRecordType = (typeof DNS_TYPES)[number]

const TYPE_NAMES: Record<number, string> = {
  1: 'A',
  2: 'NS',
  5: 'CNAME',
  6: 'SOA',
  15: 'MX',
  16: 'TXT',
  28: 'AAAA',
  33: 'SRV',
  257: 'CAA',
}

export interface DnsRecord {
  name: string
  type: string
  ttl?: number
  data: string
}

export interface DnsAnswer {
  resolver: 'cloudflare' | 'google'
  name: string
  type: DnsRecordType
  status: number
  records: DnsRecord[]
  comment?: string
  url: string
}

export interface DnsResolverConfig {
  resolver: 'cloudflare' | 'google'
  sourceId: SourceId
  buildUrl: (name: string, type: string) => string
  headers: Record<string, string>
}

export async function queryDns(
  config: DnsResolverConfig,
  name: string,
  type: DnsRecordType,
  signal?: AbortSignal,
): Promise<SourceResult<DnsAnswer>> {
  const url = config.buildUrl(name, type)
  const startedAt = performance.now()
  const response = await httpRequest<unknown>(url, {
    signal,
    headers: config.headers,
    cacheKey: `dns:${config.resolver}:${name}:${type}`,
    ttlMs: 5 * 60_000,
    sourceId: config.sourceId,
  })

  if (!response.ok || !response.data) {
    return {
      sourceId: config.sourceId,
      status: response.error === 'Запрос отменён' ? 'cancelled' : 'error',
      error: response.error,
      url,
      retrievedAt: new Date().toISOString(),
      durationMs: performance.now() - startedAt,
    }
  }

  const parsed = dnsResponseSchema.safeParse(response.data)
  if (!parsed.success) {
    return {
      sourceId: config.sourceId,
      status: 'error',
      error: 'Неожиданный формат DNS-ответа',
      url,
      retrievedAt: new Date().toISOString(),
      durationMs: performance.now() - startedAt,
    }
  }

  const records: DnsRecord[] = (parsed.data.Answer ?? []).map((record) => ({
    name: record.name.replace(/\.$/, '').toLowerCase(),
    type: TYPE_NAMES[record.type] ?? String(record.type),
    ttl: record.TTL,
    data: record.data,
  }))

  return {
    sourceId: config.sourceId,
    status: 'ok',
    data: {
      resolver: config.resolver,
      name,
      type,
      status: parsed.data.Status,
      records,
      comment: parsed.data.Comment,
      url,
    },
    url,
    retrievedAt: new Date().toISOString(),
    durationMs: performance.now() - startedAt,
  }
}
