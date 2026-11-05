import dagre from '@dagrejs/dagre'
import type { InternetEdge, InternetNode } from '../../graph/types'

export interface Point {
  x: number
  y: number
}

const NODE_WIDTH = 196
const NODE_HEIGHT = 64

export function layoutGraph(
  nodes: InternetNode[],
  edges: InternetEdge[],
): Map<string, Point> {
  const graph = new dagre.graphlib.Graph()
  graph.setDefaultEdgeLabel(() => ({}))
  graph.setGraph({
    rankdir: 'LR',
    nodesep: 42,
    ranksep: 96,
    marginx: 48,
    marginy: 48,
  })

  const visible = new Set(nodes.map((node) => node.id))
  for (const node of nodes) {
    graph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  }
  for (const edge of edges) {
    if (!visible.has(edge.source) || !visible.has(edge.target)) continue
    graph.setEdge(edge.source, edge.target)
  }

  dagre.layout(graph)

  const positions = new Map<string, Point>()
  for (const node of nodes) {
    const layout = graph.node(node.id) as { x?: number; y?: number } | undefined
    if (!layout || layout.x === undefined || layout.y === undefined) {
      positions.set(node.id, { x: 0, y: 0 })
      continue
    }
    positions.set(node.id, {
      x: layout.x - NODE_WIDTH / 2,
      y: layout.y - NODE_HEIGHT / 2,
    })
  }
  return positions
}
