import { z } from 'zod'
import {
  CONFIDENCE_LEVELS,
  EDGE_TYPES,
  INPUT_TYPES,
  INVESTIGATION_MODES,
  INVESTIGATION_STATUSES,
  NODE_LOAD_STATES,
  NODE_TYPES,
  SOURCE_IDS,
} from '../graph/types'

const evidenceSchema = z.object({
  sourceId: z.enum(SOURCE_IDS),
  sourceName: z.string(),
  url: z.string(),
  retrievedAt: z.string(),
  confidence: z.enum(CONFIDENCE_LEVELS),
  note: z.string().optional(),
})

const nodeSchema = z.object({
  id: z.string(),
  type: z.enum(NODE_TYPES),
  label: z.string(),
  identifier: z.string(),
  description: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()),
  sources: z.array(evidenceSchema),
  firstSeen: z.string(),
  lastUpdated: z.string(),
  loadState: z.enum(NODE_LOAD_STATES),
  childCount: z.number().optional(),
  completeness: z.enum(['complete', 'partial', 'unknown']),
  errors: z.array(z.string()),
})

const edgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  type: z.enum(EDGE_TYPES),
  label: z.string(),
  evidence: z.array(evidenceSchema),
  firstSeen: z.string(),
  lastUpdated: z.string(),
  confidence: z.enum(CONFIDENCE_LEVELS),
  metadata: z.record(z.string(), z.unknown()),
  explanation: z.string(),
})

const sourceResultSchema = z.object({
  sourceId: z.enum(SOURCE_IDS),
  status: z.enum(['ok', 'partial', 'error', 'unsupported', 'rate-limited', 'timeout', 'cancelled']),
  data: z.unknown().optional(),
  error: z.string().optional(),
  url: z.string(),
  retrievedAt: z.string(),
  durationMs: z.number(),
})

const investigationSchema = z.object({
  id: z.string(),
  input: z.string(),
  normalized: z.string(),
  inputType: z.enum(INPUT_TYPES),
  mode: z.enum(INVESTIGATION_MODES),
  status: z.enum(INVESTIGATION_STATUSES),
  startedAt: z.string(),
  finishedAt: z.string().optional(),
  rootNodeId: z.string().nullable(),
  rootNodeIds: z.array(z.string()).optional(),
  sourceResults: z.record(z.string(), sourceResultSchema),
  counts: z.object({
    nodes: z.number(),
    edges: z.number(),
    sourcesOk: z.number(),
    sourcesPartial: z.number(),
    sourcesFailed: z.number(),
    deferred: z.number(),
  }),
  errors: z.array(z.string()),
})

export const graphSnapshotSchema = z.object({
  version: z.number(),
  exportedAt: z.string(),
  input: z.string(),
  normalized: z.string(),
  inputType: z.enum(INPUT_TYPES),
  nodes: z.array(nodeSchema),
  edges: z.array(edgeSchema),
  sources: z.array(z.unknown()),
  investigation: investigationSchema.nullable(),
})
