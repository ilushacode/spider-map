const STATIC_ALLOWED_HOSTS = new Set([
  'dns.yandex.ru',
  'api.2ip.me',
  'ipwho.is',
  'cloudflare-dns.com',
  'dns.google',
  'stat.ripe.net',
  'data.iana.org',
  'crt.sh',
  'rdap.iana.org',
  'rdap.verisign.com',
  'rdap.arin.net',
  'rdap.db.ripe.net',
  'rdap.apnic.net',
  'rdap.lacnic.net',
  'rdap.afrinic.net',
  'rdap.nic.ad.jp',
])

const dynamicAllowedHosts = new Set<string>()

export function registerAllowedHost(host: string): void {
  const normalized = host.trim().toLowerCase()
  if (normalized) dynamicAllowedHosts.add(normalized)
}

export function isAllowedHost(host: string): boolean {
  const normalized = host.trim().toLowerCase()
  return STATIC_ALLOWED_HOSTS.has(normalized) || dynamicAllowedHosts.has(normalized)
}

export function isAllowedUrl(raw: string): boolean {
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' && isAllowedHost(url.hostname)
  } catch {
    return false
  }
}
