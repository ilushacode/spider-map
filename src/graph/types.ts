export const NODE_TYPES = [
  'domain',
  'ip',
  'prefix',
  'asn',
  'organization',
  'dns-record',
  'nameserver',
  'mail-server',
  'certificate',
  'registrar',
  'rir',
  'network',
  'exchange-point',
  'geographic-location',
  'route-collector',
  'bgp-peer',
  'unknown',
] as const

export type NodeType = (typeof NODE_TYPES)[number]

export const EDGE_TYPES = [
  'RESOLVES_TO',
  'CNAME_TO',
  'HAS_MX',
  'HAS_NS',
  'HAS_DNS_RECORD',
  'ANNOUNCED_BY',
  'WITHIN_PREFIX',
  'HAS_ORIGIN_ASN',
  'HAS_REGISTRATION',
  'HAS_CERTIFICATE',
  'CERTIFICATE_COVERS',
  'REGISTERED_BY',
  'HAS_ABUSE_CONTACT',
  'OBSERVED_IN_ROUTE',
  'BGP_PEER_OF',
  'HAS_ROUTE_COLLECTOR',
  'HAS_GEOLOCATION',
  'RELATED_PREFIX',
  'SHARES_IP_WITH',
  'HAS_SUBDOMAIN',
] as const

export type EdgeType = (typeof EDGE_TYPES)[number]

export const CONFIDENCE_LEVELS = [
  'authoritative',
  'observed',
  'corroborated',
  'inferred',
  'unknown',
] as const

export type Confidence = (typeof CONFIDENCE_LEVELS)[number]

export const SOURCE_IDS = [
  'cloudflare-dns',
  'google-dns',
  'ripestat',
  'rdap',
  'crt-sh',
] as const

export type SourceId = (typeof SOURCE_IDS)[number]

export const NODE_LOAD_STATES = [
  'unexplored',
  'loading',
  'partial',
  'explored',
  'error',
  'no-data',
  'source-limited',
] as const

export type NodeLoadState = (typeof NODE_LOAD_STATES)[number]

export const INVESTIGATION_STATUSES = [
  'idle',
  'resolving',
  'collecting',
  'partial',
  'complete',
  'cancelled',
  'error',
] as const

export type InvestigationStatus = (typeof INVESTIGATION_STATUSES)[number]

export const INVESTIGATION_MODES = ['quick', 'full', 'explore'] as const

export type InvestigationMode = (typeof INVESTIGATION_MODES)[number]

export const INPUT_TYPES = [
  'domain',
  'url',
  'ipv4',
  'ipv6',
  'cidr',
  'asn',
  'unknown',
] as const

export type InputType = (typeof INPUT_TYPES)[number]

export interface Evidence {
  sourceId: SourceId
  sourceName: string
  url: string
  retrievedAt: string
  confidence: Confidence
  note?: string
}

export interface InternetNode {
  id: string
  type: NodeType
  label: string
  identifier: string
  description?: string
  metadata: Record<string, unknown>
  sources: Evidence[]
  firstSeen: string
  lastUpdated: string
  loadState: NodeLoadState
  childCount?: number
  completeness: 'complete' | 'partial' | 'unknown'
  errors: string[]
}

export interface InternetEdge {
  id: string
  source: string
  target: string
  type: EdgeType
  label: string
  evidence: Evidence[]
  firstSeen: string
  lastUpdated: string
  confidence: Confidence
  metadata: Record<string, unknown>
  explanation: string
}

export interface DataSource {
  id: SourceId
  name: string
  category: string
  baseUrl: string
  docsUrl: string
  cors: 'supported' | 'unknown' | 'unsupported'
  ttlMs: number
  description: string
}

export type SourceStatus =
  | 'ok'
  | 'partial'
  | 'error'
  | 'unsupported'
  | 'rate-limited'
  | 'timeout'
  | 'cancelled'

export interface SourceResult<T> {
  sourceId: SourceId
  status: SourceStatus
  data?: T
  error?: string
  url: string
  retrievedAt: string
  durationMs: number
}

export interface Investigation {
  id: string
  input: string
  normalized: string
  inputType: InputType
  mode: InvestigationMode
  status: InvestigationStatus
  startedAt: string
  finishedAt?: string
  rootNodeId: string | null
  sourceResults: Record<string, SourceResult<unknown>>
  counts: {
    nodes: number
    edges: number
    sourcesOk: number
    sourcesPartial: number
    sourcesFailed: number
    deferred: number
  }
  errors: string[]
}

export interface NodeExpansionState {
  nodeId: string
  state: NodeLoadState
  attemptedSources: SourceId[]
  lastAttemptAt?: string
  error?: string
}

export interface GraphFilters {
  hiddenNodeTypes: NodeType[]
  hiddenEdgeTypes: EdgeType[]
  search: string
  minConfidence: Confidence | 'all'
}

export interface NormalizedInput {
  type: InputType
  value: string
  display: string
  error?: string
}

export interface GraphSnapshot {
  version: number
  exportedAt: string
  input: string
  normalized: string
  inputType: InputType
  nodes: InternetNode[]
  edges: InternetEdge[]
  sources: DataSource[]
  investigation: Investigation | null
}
