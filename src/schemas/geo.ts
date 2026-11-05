import { z } from 'zod'

const coordinate = z.union([z.number(), z.string()]).optional()

export const twoIpGeoSchema = z.object({
  ip: z.string().optional(),
  country: z.string().optional(),
  country_code: z.string().optional(),
  country_rus: z.string().optional(),
  region: z.string().optional(),
  region_rus: z.string().optional(),
  city: z.string().optional(),
  city_rus: z.string().optional(),
  latitude: coordinate,
  longitude: coordinate,
  time_zone: z.string().optional(),
})

export const ipwhoisGeoSchema = z.object({
  ip: z.string().optional(),
  success: z.boolean().optional(),
  country: z.string().optional(),
  country_code: z.string().optional(),
  region: z.string().optional(),
  city: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  connection: z
    .object({
      asn: z.number().optional(),
      org: z.string().optional(),
      isp: z.string().optional(),
    })
    .optional(),
  timezone: z.object({ id: z.string().optional() }).optional(),
})
