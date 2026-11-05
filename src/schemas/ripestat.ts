import { z } from 'zod'

export const ripestatEnvelopeSchema = z.object({
  status: z.string(),
  status_code: z.number().optional(),
  message: z.string().optional(),
  data: z.unknown().optional(),
})

export const networkInfoSchema = z.object({
  resource: z.string().optional(),
  prefix: z.string().nullable().optional(),
  asns: z.array(z.number()).optional(),
})

export const asOverviewSchema = z.object({
  resource: z.string().optional(),
  holder: z.string().optional(),
  announced: z.boolean().optional(),
  block: z
    .object({
      resource: z.string().optional(),
      desc: z.string().optional(),
      name: z.string().optional(),
    })
    .optional(),
})

export const announcedPrefixesSchema = z.object({
  resource: z.string().optional(),
  prefixes: z
    .array(
      z.object({
        prefix: z.string(),
        timelines: z.array(z.unknown()).optional(),
      }),
    )
    .optional(),
})

export const prefixOverviewSchema = z.object({
  resource: z.string().optional(),
  announced: z.boolean().optional(),
  asns: z
    .array(
      z.object({
        asn: z.number(),
        holder: z.string().optional(),
      }),
    )
    .optional(),
  related_prefixes: z.array(z.unknown()).optional(),
})

export const lookingGlassSchema = z.object({
  resource: z.string().optional(),
  rrcs: z
    .array(
      z.object({
        rrc: z.string().optional(),
        location: z.string().optional(),
        peers: z
          .array(
            z.object({
              asn_origin: z.number().optional(),
              as_path: z.string().optional(),
              next_hop: z.string().optional(),
              last_updated: z.string().optional(),
            }),
          )
          .optional(),
      }),
    )
    .optional(),
})

export const rpkiValidationSchema = z.object({
  resource: z.string().optional(),
  prefix: z.string().optional(),
  status: z.string().optional(),
  validating_roas: z.array(z.unknown()).optional(),
})

export const abuseContactFinderSchema = z.object({
  resource: z.string().optional(),
  abuse_contacts: z.array(z.string()).optional(),
  authorities: z.array(z.string()).optional(),
})

export const routingHistorySchema = z.object({
  resource: z.string().optional(),
  by_origin: z
    .array(
      z.object({
        origin: z.number().optional(),
        prefixes: z
          .array(
            z.object({
              prefix: z.string(),
              timelines: z.array(z.unknown()).optional(),
            }),
          )
          .optional(),
      }),
    )
    .optional(),
})

export const prefixCountSchema = z.object({
  resource: z.string().optional(),
  timeseries: z
    .array(
      z.object({
        starttime: z.string().optional(),
        endtime: z.string().optional(),
        v4: z.number().optional(),
        v6: z.number().optional(),
      }),
    )
    .optional(),
})
