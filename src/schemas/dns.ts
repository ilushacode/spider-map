import { z } from 'zod'

export const dnsRecordSchema = z.object({
  name: z.string(),
  type: z.number(),
  TTL: z.number().optional(),
  data: z.string(),
})

export const dnsResponseSchema = z.object({
  Status: z.number(),
  Answer: z.array(dnsRecordSchema).optional(),
  Authority: z.array(dnsRecordSchema).optional(),
  Comment: z.string().optional(),
})

export type DnsResponse = z.infer<typeof dnsResponseSchema>
