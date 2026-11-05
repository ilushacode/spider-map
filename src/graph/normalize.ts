import type { InputType, NormalizedInput } from './types'

const DOMAIN_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/
const IPV4_PART = /^(?:0|[1-9]\d{0,2})$/
const ASN_PATTERN = /^(?:AS)?(\d{1,10})$/i

export function normalizeDomain(raw: string): string | null {
  let value = raw.trim().toLowerCase()
  if (!value) return null
  if (value.includes('://')) {
    try {
      value = new URL(value).hostname
    } catch {
      return null
    }
  }
  value = value.replace(/\.$/, '')
  if (!value || value.length > 253) return null
  if (value.includes(':')) return null

  let ascii: string
  try {
    ascii = new URL(`http://${value}`).hostname.toLowerCase()
  } catch {
    return null
  }
  ascii = ascii.replace(/\.$/, '')
  if (!ascii || ascii.length > 253) return null

  const labels = ascii.split('.')
  if (labels.length < 2) return null
  if (!labels.every((label) => DOMAIN_LABEL.test(label))) return null
  return ascii
}

export function normalizeIpv4(raw: string): string | null {
  const parts = raw.trim().split('.')
  if (parts.length !== 4) return null
  const numbers: number[] = []
  for (const part of parts) {
    if (!IPV4_PART.test(part)) return null
    const value = Number(part)
    if (value > 255) return null
    numbers.push(value)
  }
  return numbers.join('.')
}

export function normalizeIpv6(raw: string): string | null {
  const value = raw.trim()
  if (!value.includes(':')) return null
  try {
    const hostname = new URL(`http://[${value}]`).hostname
    if (!hostname.startsWith('[') || !hostname.endsWith(']')) return null
    return hostname.slice(1, -1).toLowerCase()
  } catch {
    return null
  }
}

export function normalizeIp(raw: string): string | null {
  return normalizeIpv4(raw) ?? normalizeIpv6(raw)
}

export function normalizeCidr(raw: string): string | null {
  const value = raw.trim()
  const slash = value.lastIndexOf('/')
  if (slash <= 0) return null
  const ipPart = value.slice(0, slash)
  const prefixPart = value.slice(slash + 1)
  if (!/^\d{1,3}$/.test(prefixPart)) return null
  const prefix = Number(prefixPart)

  const ipv4 = normalizeIpv4(ipPart)
  if (ipv4) {
    if (prefix < 0 || prefix > 32) return null
    return `${ipv4}/${prefix}`
  }
  const ipv6 = normalizeIpv6(ipPart)
  if (ipv6) {
    if (prefix < 0 || prefix > 128) return null
    return `${ipv6}/${prefix}`
  }
  return null
}

export function normalizeAsn(raw: string): string | null {
  const match = ASN_PATTERN.exec(raw.trim())
  if (!match) return null
  const number = Number(match[1])
  if (!Number.isSafeInteger(number) || number < 1 || number > 4294967295) return null
  return `AS${number}`
}

export function detectInputType(raw: string): InputType {
  const value = raw.trim()
  if (!value) return 'unknown'
  if (/^https?:\/\//i.test(value)) return 'url'
  if (value.includes('/')) return normalizeCidr(value) ? 'cidr' : 'unknown'
  if (/^AS\d+$/i.test(value)) return normalizeAsn(value) ? 'asn' : 'unknown'
  if (normalizeIpv4(value)) return 'ipv4'
  if (value.includes(':')) return normalizeIpv6(value) ? 'ipv6' : 'unknown'
  if (/^\d{1,10}$/.test(value)) return normalizeAsn(value) ? 'asn' : 'unknown'
  if (normalizeDomain(value)) return 'domain'
  return 'unknown'
}

export function normalizeInput(raw: string): NormalizedInput {
  const trimmed = raw.trim()
  if (!trimmed) {
    return { type: 'unknown', value: '', display: '', error: 'Введите домен, IP, CIDR или ASN' }
  }
  if (trimmed.length > 2048) {
    return { type: 'unknown', value: '', display: trimmed.slice(0, 64), error: 'Слишком длинный ввод' }
  }

  const type = detectInputType(trimmed)
  switch (type) {
    case 'url': {
      try {
        const url = new URL(trimmed)
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
          return { type: 'unknown', value: '', display: trimmed, error: 'Разрешены только http и https' }
        }
        const domain = normalizeDomain(url.hostname)
        if (!domain) {
          return { type: 'unknown', value: '', display: trimmed, error: 'Некорректный hostname' }
        }
        return { type: 'domain', value: domain, display: domain }
      } catch {
        return { type: 'unknown', value: '', display: trimmed, error: 'Некорректный URL' }
      }
    }
    case 'domain': {
      const domain = normalizeDomain(trimmed)
      return domain
        ? { type: 'domain', value: domain, display: domain }
        : { type: 'unknown', value: '', display: trimmed, error: 'Некорректный домен' }
    }
    case 'ipv4':
    case 'ipv6': {
      const ip = normalizeIp(trimmed)
      return ip
        ? { type, value: ip, display: ip }
        : { type: 'unknown', value: '', display: trimmed, error: 'Некорректный IP-адрес' }
    }
    case 'cidr': {
      const cidr = normalizeCidr(trimmed)
      return cidr
        ? { type, value: cidr, display: cidr }
        : { type: 'unknown', value: '', display: trimmed, error: 'Некорректный CIDR' }
    }
    case 'asn': {
      const asn = normalizeAsn(trimmed)
      return asn
        ? { type, value: asn, display: asn }
        : { type: 'unknown', value: '', display: trimmed, error: 'Некорректный ASN' }
    }
    default:
      return {
        type: 'unknown',
        value: '',
        display: trimmed,
        error: 'Не удалось определить тип: домен, URL, IPv4, IPv6, CIDR или ASN',
      }
  }
}

export function isPrivateOrSpecialIp(raw: string): boolean {
  const ipv4 = normalizeIpv4(raw)
  if (ipv4) {
    const [a, b] = ipv4.split('.').map(Number)
    if (a === 0 || a === 10 || a === 127) return true
    if (a === 100 && b >= 64 && b <= 127) return true
    if (a === 169 && b === 254) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 192 && b === 0) return true
    if (a === 198 && (b === 18 || b === 19)) return true
    if (a === 198 && b === 51) return true
    if (a === 203 && b === 0) return true
    if (a >= 224) return true
    return false
  }
  const ipv6 = normalizeIpv6(raw)
  if (ipv6) {
    if (ipv6 === '::' || ipv6 === '::1') return true
    if (ipv6.startsWith('fc') || ipv6.startsWith('fd')) return true
    if (ipv6.startsWith('fe8') || ipv6.startsWith('fe9') || ipv6.startsWith('fea') || ipv6.startsWith('feb')) return true
    if (ipv6.startsWith('::ffff:')) return true
    return false
  }
  return false
}
