import { edgeId, nodeId } from './ids'
import { RELATIONSHIPS } from './relationships'
import type {
  Confidence,
  EdgeType,
  Evidence,
  InternetEdge,
  InternetNode,
  NodeLoadState,
  NodeType,
} from './types'

export interface CreateNodeInput {
  type: NodeType
  identifier: string
  label?: string
  description?: string
  metadata?: Record<string, unknown>
  evidence: Evidence
  childCount?: number
  loadState?: NodeLoadState
  completeness?: InternetNode['completeness']
}

export function createNode(input: CreateNodeInput): InternetNode {
  const now = new Date().toISOString()
  return {
    id: nodeId(input.type, input.identifier),
    type: input.type,
    label: input.label ?? input.identifier,
    identifier: input.identifier,
    description: input.description,
    metadata: input.metadata ?? {},
    sources: [input.evidence],
    firstSeen: now,
    lastUpdated: now,
    loadState: input.loadState ?? 'unexplored',
    childCount: input.childCount,
    completeness: input.completeness ?? 'unknown',
    errors: [],
  }
}

export interface CreateEdgeInput {
  type: EdgeType
  source: string
  target: string
  evidence: Evidence
  label?: string
  explanation?: string
  confidence?: Confidence
  metadata?: Record<string, unknown>
}

export function createEdge(input: CreateEdgeInput): InternetEdge {
  const now = new Date().toISOString()
  const info = RELATIONSHIPS[input.type]
  return {
    id: edgeId(input.type, input.source, input.target),
    source: input.source,
    target: input.target,
    type: input.type,
    label: input.label ?? info.label,
    evidence: [input.evidence],
    firstSeen: now,
    lastUpdated: now,
    confidence: input.confidence ?? info.confidence,
    metadata: input.metadata ?? {},
    explanation: input.explanation ?? info.explanation,
  }
}
