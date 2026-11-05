import { beforeEach, describe, expect, it } from 'vitest'
import { mergeEdges, mergeNodes } from './deduplicate'
import { createEdge, createNode } from './factory'
import { useGraphStore } from './graph-store'
import type { Evidence } from './types'

const evidence: Evidence = {
  sourceId: 'cloudflare-dns',
  sourceName: 'Cloudflare DNS',
  url: 'https://cloudflare-dns.com/dns-query?name=example.com&type=A',
  retrievedAt: '2026-01-01T00:00:00.000Z',
  confidence: 'observed',
}

const secondEvidence: Evidence = {
  sourceId: 'google-dns',
  sourceName: 'Google Public DNS',
  url: 'https://dns.google/resolve?name=example.com&type=A',
  retrievedAt: '2026-01-01T00:00:01.000Z',
  confidence: 'observed',
}

describe('graph factory and deduplication', () => {
  it('creates stable node ids', () => {
    const node = createNode({ type: 'domain', identifier: 'Example.COM', evidence })
    expect(node.id).toBe('domain:example.com')
    expect(node.label).toBe('Example.COM')
  })

  it('merges nodes without duplicating sources', () => {
    const first = createNode({ type: 'ip', identifier: '1.1.1.1', evidence })
    const second = createNode({
      type: 'ip',
      identifier: '1.1.1.1',
      evidence: secondEvidence,
      metadata: { country: 'AU' },
    })
    const merged = mergeNodes(first, second)
    expect(merged.sources).toHaveLength(2)
    expect(merged.metadata.country).toBe('AU')
    expect(merged.sources[0].sourceId).toBe('cloudflare-dns')
  })

  it('does not duplicate identical evidence', () => {
    const first = createNode({ type: 'ip', identifier: '1.1.1.1', evidence })
    const merged = mergeNodes(first, createNode({ type: 'ip', identifier: '1.1.1.1', evidence }))
    expect(merged.sources).toHaveLength(1)
  })

  it('merges edges and marks them corroborated across sources', () => {
    const first = createEdge({
      type: 'RESOLVES_TO',
      source: 'domain:example.com',
      target: 'ip:1.1.1.1',
      evidence,
    })
    const second = createEdge({
      type: 'RESOLVES_TO',
      source: 'domain:example.com',
      target: 'ip:1.1.1.1',
      evidence: secondEvidence,
    })
    const merged = mergeEdges(first, second)
    expect(merged.evidence).toHaveLength(2)
    expect(merged.confidence).toBe('corroborated')
  })
})

describe('graph store', () => {
  beforeEach(() => {
    useGraphStore.getState().reset()
  })

  it('adds nodes and edges with counts', () => {
    const domain = createNode({ type: 'domain', identifier: 'example.com', evidence })
    const ip = createNode({ type: 'ip', identifier: '93.184.216.34', evidence })
    const link = createEdge({
      type: 'RESOLVES_TO',
      source: domain.id,
      target: ip.id,
      evidence,
    })
    const store = useGraphStore.getState()
    store.addNode(domain)
    store.addNode(ip)
    useGraphStore.getState().addEdge(link)

    const state = useGraphStore.getState()
    expect(Object.keys(state.nodes)).toHaveLength(2)
    expect(Object.keys(state.edges)).toHaveLength(1)
  })

  it('ignores edges whose endpoints are missing', () => {
    const link = createEdge({
      type: 'RESOLVES_TO',
      source: 'domain:missing.example',
      target: 'ip:1.1.1.1',
      evidence,
    })
    useGraphStore.getState().addEdge(link)
    expect(Object.keys(useGraphStore.getState().edges)).toHaveLength(0)
  })

  it('updates node load state', () => {
    const node = createNode({ type: 'asn', identifier: 'AS13335', evidence })
    useGraphStore.getState().addNode(node)
    useGraphStore.getState().setNodeLoadState(node.id, 'explored')
    expect(useGraphStore.getState().nodes[node.id].loadState).toBe('explored')
  })

  it('toggles filters', () => {
    useGraphStore.getState().toggleNodeType('certificate')
    expect(useGraphStore.getState().filters.hiddenNodeTypes).toContain('certificate')
    useGraphStore.getState().toggleNodeType('certificate')
    expect(useGraphStore.getState().filters.hiddenNodeTypes).not.toContain('certificate')
  })
})
