import type { SourceResult } from '../../graph/types'
import { queryDns, type DnsAnswer, type DnsRecordType } from './dns'

const CONFIG = {
  resolver: 'cloudflare' as const,
  sourceId: 'cloudflare-dns' as const,
  buildUrl: (name: string, type: string) =>
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${encodeURIComponent(type)}`,
  headers: { Accept: 'application/dns-json' },
}

export function queryCloudflareDns(
  name: string,
  type: DnsRecordType,
  signal?: AbortSignal,
): Promise<SourceResult<DnsAnswer>> {
  return queryDns(CONFIG, name, type, signal)
}
