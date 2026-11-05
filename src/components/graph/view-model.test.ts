import { describe, expect, it } from 'vitest'
import type { Evidence, GraphFilters, InternetEdge, InternetNode } from '../../graph/types'
import { createEdge, createNode } from '../../graph/factory'
import { GRAPH_GROUPS } from './groups'
import {
  buildAdjacency,
  computeCategoryView,
  computeGroups,
  pathToRoots,
  reachableFrom,
} from './view-model'

const evidence: Evidence = {
  sourceId: 'ripestat',
  sourceName: 'RIPEstat',
  url: 'https://stat.ripe.net/',
  retrievedAt: '2026-01-01T00:00:00.000Z',
  confidence: 'observed',
}

function node(type: InternetNode['type'], id: string): InternetNode {
  return createNode({ type, identifier: id, evidence })
}

function edge(
  type: InternetEdge['type'],
  source: InternetNode,
  target: InternetNode,
): InternetEdge {
  return createEdge({ type, source: source.id, target: target.id, evidence })
}

const filters: GraphFilters = {
  hiddenNodeTypes: [],
  hiddenEdgeTypes: [],
  hiddenNodeIds: [],
  search: '',
  minConfidence: 'all',
}

function graph() {
  const first = node('domain', 'first.example')
  const second = node('domain', 'second.example')
  const ip = node('ip', '203.0.113.10')
  const prefix = node('prefix', '203.0.113.0/24')
  const asn = node('asn', 'AS64500')
  const edges = [
    edge('RESOLVES_TO', first, ip),
    edge('RESOLVES_TO', second, ip),
    edge('WITHIN_PREFIX', ip, prefix),
    edge('ANNOUNCED_BY', prefix, asn),
  ]
  return { first, second, ip, prefix, asn, edges }
}

describe('graph view model', () => {
  it('walks the undirected adjacency of the graph', () => {
    const { first, asn, edges } = graph()
    const adjacency = buildAdjacency(edges)
    const reachable = reachableFrom(first.id, adjacency)
    expect(reachable.has(asn.id)).toBe(true)
    expect(reachable.has(first.id)).toBe(true)
  })

  it('finds a path from a category node back to a root', () => {
    const { first, asn, edges } = graph()
    const adjacency = buildAdjacency(edges)
    const path = pathToRoots(asn.id, [first.id], adjacency)
    expect(path[0]).toBe(first.id)
    expect(path[path.length - 1]).toBe(asn.id)
  })

  it('counts nodes shared by multiple roots', () => {
    const { first, second, ip, edges } = graph()
    const reachableByRoot = new Map([
      [first.id, reachableFrom(first.id, buildAdjacency(edges))],
      [second.id, reachableFrom(second.id, buildAdjacency(edges))],
    ])
    const groups = computeGroups(
      {
        [first.id]: first,
        [second.id]: second,
        [ip.id]: ip,
      },
      [first.id, second.id],
      reachableByRoot,
      GRAPH_GROUPS,
    )
    const ipGroup = groups.find((item) => item.group.id === 'ip')
    expect(ipGroup?.nodes).toHaveLength(1)
    expect(ipGroup?.shared).toBe(1)
  })

  it('includes path context when opening a category', () => {
    const { first, second, ip, prefix, asn, edges } = graph()
    const storeNodes = {
      [first.id]: first,
      [second.id]: second,
      [ip.id]: ip,
      [prefix.id]: prefix,
      [asn.id]: asn,
    }
    const storeEdges = Object.fromEntries(edges.map((item) => [item.id, item]))
    const adjacency = buildAdjacency(edges)
    const asnGroup = GRAPH_GROUPS.find((group) => group.id === 'asn')!
    const view = computeCategoryView(
      storeNodes,
      storeEdges,
      [first.id],
      adjacency,
      asnGroup,
      filters,
    )
    expect(view.nodes.some((item) => item.id === asn.id)).toBe(true)
    expect(view.nodes.some((item) => item.id === ip.id)).toBe(true)
    expect(view.nodes.some((item) => item.id === prefix.id)).toBe(true)
    expect(view.edges.length).toBeGreaterThan(0)
  })
})
