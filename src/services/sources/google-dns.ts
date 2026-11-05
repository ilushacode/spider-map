import type { SourceResult } from '../../graph/types'
import { queryDns, type DnsAnswer, type DnsRecordType } from './dns'

const CONFIG = {
  resolver: 'google' as const,
  sourceId: 'google-dns' as const,
  buildUrl: (name: string, type: string) =>
    `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${encodeURIComponent(type)}`,
  headers: { Accept: 'application/json' },
}

export function queryGoogleDns(
  name: string,
  type: DnsRecordType,
  signal?: AbortSignal,
): Promise<SourceResult<DnsAnswer>> {
  return queryDns(CONFIG, name, type, signal)
}
