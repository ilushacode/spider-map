import type { SourceResult } from '../../graph/types'
import { queryDns, type DnsAnswer, type DnsRecordType } from './dns'

const CONFIG = {
  resolver: 'yandex' as const,
  sourceId: 'yandex-dns' as const,
  buildUrl: (name: string, type: string) =>
    `https://dns.yandex.ru/dns-query?name=${encodeURIComponent(name)}&type=${encodeURIComponent(type)}`,
  headers: { Accept: 'application/dns-json' },
  retries: 0,
}

let available: boolean | null = null

export function resetYandexDnsAvailability(): void {
  available = null
}

export function isYandexDnsAvailable(): boolean {
  return available !== false
}

export async function queryYandexDns(
  name: string,
  type: DnsRecordType,
  signal?: AbortSignal,
): Promise<SourceResult<DnsAnswer>> {
  if (available === false) {
    return {
      sourceId: 'yandex-dns',
      status: 'unsupported',
      error: 'Яндекс DNS недоступен, используется резервный резолвер',
      url: 'https://dns.yandex.ru/',
      retrievedAt: new Date().toISOString(),
      durationMs: 0,
    }
  }

  const result = await queryDns(CONFIG, name, type, signal)
  if (result.status === 'ok') {
    available = true
  } else if (result.status !== 'cancelled') {
    available = false
  }
  return result
}
