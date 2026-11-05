import type { DataSource } from '../../graph/types'

export const DATA_SOURCES: DataSource[] = [
  {
    id: 'cloudflare-dns',
    name: 'Cloudflare DNS',
    category: 'DNS',
    baseUrl: 'https://cloudflare-dns.com/dns-query',
    docsUrl:
      'https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/make-api-requests/',
    cors: 'supported',
    ttlMs: 5 * 60_000,
    description: 'Основной DNS-over-HTTPS резолвер для A, AAAA, CNAME, MX, NS, TXT, SOA, CAA и SRV.',
  },
  {
    id: 'google-dns',
    name: 'Google Public DNS',
    category: 'DNS',
    baseUrl: 'https://dns.google/resolve',
    docsUrl: 'https://developers.google.com/speed/public-dns/docs/doh/json',
    cors: 'supported',
    ttlMs: 5 * 60_000,
    description: 'Независимый DNS-over-HTTPS резолвер для проверки ключевых записей.',
  },
  {
    id: 'ripestat',
    name: 'RIPE NCC RIPEstat',
    category: 'Сети и маршрутизация',
    baseUrl: 'https://stat.ripe.net/data',
    docsUrl: 'https://stat.ripe.net/docs/data-api/ripestat-data-api',
    cors: 'supported',
    ttlMs: 15 * 60_000,
    description:
      'Сетевые сведения: network-info, AS overview, префиксы, looking glass, RPKI, abuse-контакты, история.',
  },
  {
    id: 'rdap',
    name: 'IANA RDAP Bootstrap',
    category: 'Регистрация',
    baseUrl: 'https://data.iana.org/rdap',
    docsUrl: 'https://www.icann.org/rdap/',
    cors: 'supported',
    ttlMs: 6 * 60 * 60_000,
    description:
      'Авторитетные RDAP-серверы для доменов, IP и ASN, выбранные по bootstrap-файлам IANA.',
  },
  {
    id: 'crt-sh',
    name: 'Certificate Transparency (crt.sh)',
    category: 'Сертификаты',
    baseUrl: 'https://crt.sh/',
    docsUrl: 'https://crt.sh/',
    cors: 'unknown',
    ttlMs: 6 * 60 * 60_000,
    description: 'Дополнительный источник сертификатов и имён из Certificate Transparency.',
  },
]

export function getDataSource(id: DataSource['id']): DataSource | undefined {
  return DATA_SOURCES.find((source) => source.id === id)
}
