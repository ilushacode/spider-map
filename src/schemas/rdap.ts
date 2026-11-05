import { z } from 'zod'

export const rdapBootstrapSchema = z.object({
  services: z.array(z.tuple([z.array(z.string()), z.array(z.string())])),
})

export const rdapEventSchema = z.object({
  eventAction: z.string(),
  eventDate: z.string().optional(),
})

export const rdapEntitySchema = z.object({
  handle: z.string().optional(),
  roles: z.array(z.string()).optional(),
  vcardArray: z.array(z.unknown()).optional(),
  publicIds: z.array(z.unknown()).optional(),
  links: z.array(z.object({ href: z.string().optional() })).optional(),
})

export const rdapDomainSchema = z.object({
  objectClassName: z.string().optional(),
  handle: z.string().optional(),
  ldhName: z.string().optional(),
  unicodeName: z.string().optional(),
  status: z.array(z.string()).optional(),
  events: z.array(rdapEventSchema).optional(),
  nameservers: z.array(z.object({ ldhName: z.string().optional() })).optional(),
  entities: z.array(rdapEntitySchema).optional(),
})

export const rdapIpSchema = z.object({
  objectClassName: z.string().optional(),
  handle: z.string().optional(),
  startAddress: z.string().optional(),
  endAddress: z.string().optional(),
  ipVersion: z.string().optional(),
  name: z.string().optional(),
  country: z.string().optional(),
  status: z.array(z.string()).optional(),
  events: z.array(rdapEventSchema).optional(),
  entities: z.array(rdapEntitySchema).optional(),
})

export const rdapAutnumSchema = z.object({
  objectClassName: z.string().optional(),
  handle: z.string().optional(),
  startAutnum: z.number().optional(),
  endAutnum: z.number().optional(),
  name: z.string().optional(),
  status: z.array(z.string()).optional(),
  events: z.array(rdapEventSchema).optional(),
  entities: z.array(rdapEntitySchema).optional(),
})
