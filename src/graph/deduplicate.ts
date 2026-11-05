import type { Confidence, Evidence, InternetEdge, InternetNode, NodeLoadState } from './types'

const CONFIDENCE_RANK: Record<Confidence, number> = {
  unknown: 0,
  inferred: 1,
  observed: 2,
  corroborated: 3,
  authoritative: 4,
}

const LOAD_STATE_RANK: Record<NodeLoadState, number> = {
  unexplored: 0,
  loading: 1,
  error: 2,
  'no-data': 3,
  'source-limited': 4,
  partial: 5,
  explored: 6,
}

function evidenceKey(evidence: Evidence): string {
  return `${evidence.sourceId}|${evidence.url}|${evidence.retrievedAt}`
}

export function mergeEvidence(current: Evidence[], incoming: Evidence[]): Evidence[] {
  const seen = new Set(current.map(evidenceKey))
  const merged = [...current]
  for (const evidence of incoming) {
    const key = evidenceKey(evidence)
    if (!seen.has(key)) {
      seen.add(key)
      merged.push(evidence)
    }
  }
  return merged
}

export function mergeConfidence(current: Confidence, incoming: Confidence): Confidence {
  // `corroborated` is only assigned when multiple independent sources agree.
  return CONFIDENCE_RANK[incoming] > CONFIDENCE_RANK[current] ? incoming : current
}

export function mergeLoadState(current: NodeLoadState, incoming: NodeLoadState): NodeLoadState {
  if (incoming === 'unexplored') return current
  if (current === 'explored' && incoming !== 'error') return current
  return LOAD_STATE_RANK[incoming] >= LOAD_STATE_RANK[current] ? incoming : current
}

export function mergeNodes(current: InternetNode, incoming: InternetNode): InternetNode {
  return {
    ...current,
    ...incoming,
    label: incoming.label || current.label,
    description: incoming.description ?? current.description,
    metadata: { ...current.metadata, ...incoming.metadata },
    sources: mergeEvidence(current.sources, incoming.sources),
    firstSeen: current.firstSeen < incoming.firstSeen ? current.firstSeen : incoming.firstSeen,
    lastUpdated: current.lastUpdated > incoming.lastUpdated ? current.lastUpdated : incoming.lastUpdated,
    loadState: mergeLoadState(current.loadState, incoming.loadState),
    childCount: incoming.childCount ?? current.childCount,
    completeness: incoming.completeness === 'unknown' ? current.completeness : incoming.completeness,
    errors: [...new Set([...current.errors, ...incoming.errors])],
  }
}

export function mergeEdges(current: InternetEdge, incoming: InternetEdge): InternetEdge {
  const evidence = mergeEvidence(current.evidence, incoming.evidence)
  const independentSources = new Set(evidence.map((item) => item.sourceId))
  let confidence = mergeConfidence(current.confidence, incoming.confidence)
  if (independentSources.size > 1 && confidence !== 'authoritative') confidence = 'corroborated'

  return {
    ...current,
    ...incoming,
    label: incoming.label || current.label,
    explanation: incoming.explanation || current.explanation,
    evidence,
    metadata: { ...current.metadata, ...incoming.metadata },
    firstSeen: current.firstSeen < incoming.firstSeen ? current.firstSeen : incoming.firstSeen,
    lastUpdated: current.lastUpdated > incoming.lastUpdated ? current.lastUpdated : incoming.lastUpdated,
    confidence,
  }
}
