import { z } from 'zod'
import type { SourceResult } from '../../graph/types'
import { httpRequest } from '../http/client'

const SOURCE_ID = 'crt-sh' as const
const TTL_MS = 6 * 60 * 60_000

const crtEntrySchema = z.object({
  id: z.number(),
  common_name: z.string().nullable().optional(),
  name_value: z.string().optional(),
  issuer_name: z.string().optional(),
  not_before: z.string().optional(),
  not_after: z.string().optional(),
  serial_number: z.string().optional(),
})

const crtResponseSchema = z.array(crtEntrySchema)

export interface CertificateRecord {
  id: number
  commonName?: string
  names: string[]
  issuerName?: string
  notBefore?: string
  notAfter?: string
  serialNumber?: string
}

export interface CertificateSearch {
  domain: string
  certificates: CertificateRecord[]
  url: string
}

export async function searchCertificates(
  domain: string,
  signal?: AbortSignal,
): Promise<SourceResult<CertificateSearch>> {
  const url = `https://crt.sh/?q=${encodeURIComponent(`%.${domain}`)}&output=json`
  const startedAt = performance.now()
  const response = await httpRequest<unknown>(url, {
    signal,
    headers: { Accept: 'application/json' },
    cacheKey: `crt:${domain}`,
    ttlMs: TTL_MS,
    sourceId: SOURCE_ID,
    maxBytes: 5_000_000,
    retries: 1,
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

  const parsed = crtResponseSchema.safeParse(response.data)
  if (!parsed.success) {
    return {
      sourceId: SOURCE_ID,
      status: 'error',
      error: 'Неожиданный формат ответа crt.sh',
      url,
      retrievedAt: new Date().toISOString(),
      durationMs: performance.now() - startedAt,
    }
  }

  const certificates: CertificateRecord[] = parsed.data.map((entry) => {
    const names = (entry.name_value ?? '')
      .split('\n')
      .map((name) => name.trim().toLowerCase().replace(/\.$/, ''))
      .filter(Boolean)
    return {
      id: entry.id,
      commonName: entry.common_name?.toLowerCase().replace(/\.$/, ''),
      names: [...new Set(names)],
      issuerName: entry.issuer_name,
      notBefore: entry.not_before,
      notAfter: entry.not_after,
      serialNumber: entry.serial_number,
    }
  })

  return {
    sourceId: SOURCE_ID,
    status: 'ok',
    data: { domain, certificates, url },
    url,
    retrievedAt: new Date().toISOString(),
    durationMs: performance.now() - startedAt,
  }
}
