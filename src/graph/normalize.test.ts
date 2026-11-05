import { describe, expect, it } from 'vitest'
import {
  detectInputType,
  isPrivateOrSpecialIp,
  normalizeAsn,
  normalizeCidr,
  normalizeDomain,
  normalizeInput,
  normalizeIpv4,
  normalizeIpv6,
} from './normalize'

describe('normalizeDomain', () => {
  it('lowercases and strips trailing dot', () => {
    expect(normalizeDomain('Example.COM.')).toBe('example.com')
  })

  it('extracts hostname from URL', () => {
    expect(normalizeDomain('https://www.example.com/path?q=1')).toBe('www.example.com')
  })

  it('converts IDN to punycode', () => {
    expect(normalizeDomain('пример.рф')).toBe('xn--e1afmkfd.xn--p1ai')
  })

  it('rejects invalid domains', () => {
    expect(normalizeDomain('localhost')).toBeNull()
    expect(normalizeDomain('-bad.com')).toBeNull()
    expect(normalizeDomain('bad_.com')).toBeNull()
    expect(normalizeDomain('')).toBeNull()
  })
})

describe('IP normalization', () => {
  it('normalizes IPv4', () => {
    expect(normalizeIpv4('1.1.1.1')).toBe('1.1.1.1')
    expect(normalizeIpv4('255.255.255.255')).toBe('255.255.255.255')
  })

  it('rejects invalid IPv4', () => {
    expect(normalizeIpv4('256.1.1.1')).toBeNull()
    expect(normalizeIpv4('1.1.1')).toBeNull()
    expect(normalizeIpv4('01.1.1.1')).toBeNull()
  })

  it('normalizes IPv6', () => {
    expect(normalizeIpv6('2606:4700:4700::1111')).toBe('2606:4700:4700::1111')
    expect(normalizeIpv6('::1')).toBe('::1')
  })

  it('rejects invalid IPv6', () => {
    expect(normalizeIpv6('not:an:ip')).toBeNull()
  })

  it('detects private and special addresses', () => {
    expect(isPrivateOrSpecialIp('10.0.0.1')).toBe(true)
    expect(isPrivateOrSpecialIp('192.168.1.1')).toBe(true)
    expect(isPrivateOrSpecialIp('127.0.0.1')).toBe(true)
    expect(isPrivateOrSpecialIp('1.1.1.1')).toBe(false)
    expect(isPrivateOrSpecialIp('::1')).toBe(true)
    expect(isPrivateOrSpecialIp('2606:4700:4700::1111')).toBe(false)
  })
})

describe('CIDR and ASN', () => {
  it('normalizes CIDR', () => {
    expect(normalizeCidr('104.16.0.0/13')).toBe('104.16.0.0/13')
    expect(normalizeCidr('2606:4700::/32')).toBe('2606:4700::/32')
  })

  it('rejects invalid CIDR', () => {
    expect(normalizeCidr('104.16.0.0/33')).toBeNull()
    expect(normalizeCidr('104.16.0.0')).toBeNull()
  })

  it('normalizes ASN', () => {
    expect(normalizeAsn('AS13335')).toBe('AS13335')
    expect(normalizeAsn('as13335')).toBe('AS13335')
    expect(normalizeAsn('13335')).toBe('AS13335')
  })

  it('rejects invalid ASN', () => {
    expect(normalizeAsn('AS0')).toBeNull()
    expect(normalizeAsn('AS99999999999')).toBeNull()
  })
})

describe('detectInputType and normalizeInput', () => {
  it('detects all supported input types', () => {
    expect(detectInputType('example.com')).toBe('domain')
    expect(detectInputType('https://www.example.com/path')).toBe('url')
    expect(detectInputType('1.1.1.1')).toBe('ipv4')
    expect(detectInputType('2606:4700:4700::1111')).toBe('ipv6')
    expect(detectInputType('104.16.0.0/13')).toBe('cidr')
    expect(detectInputType('AS13335')).toBe('asn')
    expect(detectInputType('not a host')).toBe('unknown')
  })

  it('normalizes URL to domain', () => {
    expect(normalizeInput('https://www.example.com/path')).toEqual({
      type: 'domain',
      value: 'www.example.com',
      display: 'www.example.com',
    })
  })

  it('returns readable errors', () => {
    expect(normalizeInput('').error).toBeTruthy()
    expect(normalizeInput('ftp://example.com').error).toBeTruthy()
    expect(normalizeInput('999.1.1.1').error).toBeTruthy()
  })
})
