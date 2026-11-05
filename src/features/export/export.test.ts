import { beforeEach, describe, expect, it } from 'vitest'
import { createNode } from '../../graph/factory'
import { useGraphStore } from '../../graph/graph-store'
import type { Evidence } from '../../graph/types'
import { buildSnapshot, importJson, restoreGraph, saveGraph } from './export'

const evidence: Evidence = {
  sourceId: 'cloudflare-dns',
  sourceName: 'Cloudflare DNS',
  url: 'https://cloudflare-dns.com/dns-query?name=example.com&type=A',
  retrievedAt: '2026-01-01T00:00:00.000Z',
  confidence: 'observed',
}

function seedGraph() {
  const node = createNode({ type: 'domain', identifier: 'example.com', evidence })
  useGraphStore.getState().addNode(node)
  return node
}

describe('export and persistence', () => {
  beforeEach(() => {
    useGraphStore.getState().reset()
    localStorage.clear()
  })

  it('builds a versioned snapshot', () => {
    const node = seedGraph()
    const snapshot = buildSnapshot()
    expect(snapshot.version).toBe(1)
    expect(snapshot.nodes).toHaveLength(1)
    expect(snapshot.nodes[0].id).toBe(node.id)
  })

  it('saves and restores the graph', () => {
    const node = seedGraph()
    expect(saveGraph()).toBeNull()
    useGraphStore.getState().reset()
    expect(restoreGraph()).toBeNull()
    expect(useGraphStore.getState().nodes[node.id]).toBeTruthy()
  })

  it('imports a valid snapshot', async () => {
    seedGraph()
    const file = new File([JSON.stringify(buildSnapshot())], 'graph.json', {
      type: 'application/json',
    })
    const error = await importJson(file)
    expect(error).toBeNull()
    expect(Object.keys(useGraphStore.getState().nodes)).toHaveLength(1)
  })

  it('rejects malformed files', async () => {
    const file = new File(['{not json'], 'graph.json', { type: 'application/json' })
    expect(await importJson(file)).toBeTruthy()
  })

  it('rejects snapshots with an invalid shape', async () => {
    const file = new File([JSON.stringify({ version: 1 })], 'graph.json', {
      type: 'application/json',
    })
    expect(await importJson(file)).toBeTruthy()
  })
})
