import type {
  Confidence,
  EdgeType,
  GraphFilters,
  InternetEdge,
  InternetNode,
  NodeType,
} from '../../graph/types'
import type { GraphGroup } from './groups'

export const CONFIDENCE_RANK: Record<Confidence, number> = {
  unknown: 0,
  inferred: 1,
  observed: 2,
  corroborated: 3,
  authoritative: 4,
}

export function isNodeVisible(
  node: InternetNode,
  hidden: NodeType[],
  hiddenIds: string[],
  search: string,
  minConfidence: Confidence | 'all',
): boolean {
  if (hidden.includes(node.type) || hiddenIds.includes(node.id)) return false
  if (minConfidence !== 'all') {
    const rank = Math.max(
      0,
      ...node.sources.map((evidence) => CONFIDENCE_RANK[evidence.confidence]),
    )
    if (rank < CONFIDENCE_RANK[minConfidence]) return false
  }
  if (!search) return true
  const query = search.toLowerCase()
  return (
    node.label.toLowerCase().includes(query) ||
    node.identifier.toLowerCase().includes(query) ||
    node.type.includes(query)
  )
}

export function isEdgeVisible(
  edge: InternetEdge,
  hidden: EdgeType[],
  minConfidence: Confidence | 'all',
): boolean {
  if (hidden.includes(edge.type)) return false
  if (minConfidence !== 'all' && CONFIDENCE_RANK[edge.confidence] < CONFIDENCE_RANK[minConfidence]) {
    return false
  }
  return true
}

export function buildAdjacency(edges: InternetEdge[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>()
  for (const edge of edges) {
    if (!map.has(edge.source)) map.set(edge.source, new Set())
    if (!map.has(edge.target)) map.set(edge.target, new Set())
    map.get(edge.source)?.add(edge.target)
    map.get(edge.target)?.add(edge.source)
  }
  return map
}

export function reachableFrom(start: string, adjacency: Map<string, Set<string>>): Set<string> {
  const visited = new Set<string>([start])
  const queue = [start]
  while (queue.length > 0) {
    const current = queue.shift()
    if (!current) break
    for (const next of adjacency.get(current) ?? []) {
      if (visited.has(next)) continue
      visited.add(next)
      queue.push(next)
    }
  }
  return visited
}

export function pathToRoots(
  target: string,
  roots: string[],
  adjacency: Map<string, Set<string>>,
): string[] {
  if (roots.includes(target)) return [target]
  const rootSet = new Set(roots)
  const queue = [target]
  const parent = new Map<string, string | null>([[target, null]])
  while (queue.length > 0) {
    const current = queue.shift()
    if (!current) break
    for (const next of adjacency.get(current) ?? []) {
      if (parent.has(next)) continue
      parent.set(next, current)
      if (rootSet.has(next)) {
        const path: string[] = []
        let cursor: string | null = next
        while (cursor) {
          path.push(cursor)
          cursor = parent.get(cursor) ?? null
        }
        return path
      }
      queue.push(next)
    }
  }
  return [target]
}

export interface GroupData {
  group: GraphGroup
  nodes: InternetNode[]
  shared: number
}

export function computeGroups(
  storeNodes: Record<string, InternetNode>,
  rootIds: string[],
  reachableByRoot: Map<string, Set<string>>,
  groups: GraphGroup[],
): GroupData[] {
  const allReachable = new Set<string>(rootIds)
  for (const reachable of reachableByRoot.values()) {
    for (const id of reachable) allReachable.add(id)
  }

  return groups
    .map((group) => {
      const nodes = [...allReachable]
        .map((id) => storeNodes[id])
        .filter(
          (node): node is InternetNode =>
            Boolean(node) && !rootIds.includes(node.id) && group.types.includes(node.type),
        )
      const shared = nodes.filter(
        (node) =>
          rootIds.filter((rootId) => reachableByRoot.get(rootId)?.has(node.id)).length > 1,
      ).length
      return { group, nodes, shared }
    })
    .filter((item) => item.nodes.length > 0)
}

export interface CategoryData {
  group: GraphGroup
  nodes: InternetNode[]
  edges: InternetEdge[]
}

export function computeCategoryView(
  storeNodes: Record<string, InternetNode>,
  storeEdges: Record<string, InternetEdge>,
  rootIds: string[],
  adjacency: Map<string, Set<string>>,
  group: GraphGroup,
  filters: GraphFilters,
): CategoryData {
  const allReachable = new Set<string>(rootIds)
  for (const rootId of rootIds) {
    for (const id of reachableFrom(rootId, adjacency)) allReachable.add(id)
  }

  const categoryNodes = [...allReachable]
    .map((id) => storeNodes[id])
    .filter(
      (node): node is InternetNode =>
        Boolean(node) &&
        group.types.includes(node.type) &&
        isNodeVisible(
          node,
          filters.hiddenNodeTypes,
          filters.hiddenNodeIds,
          filters.search,
          filters.minConfidence,
        ),
    )

  const visible = new Set<string>(rootIds)
  for (const node of categoryNodes) {
    visible.add(node.id)
    for (const pathId of pathToRoots(node.id, rootIds, adjacency)) visible.add(pathId)
  }

  const nodes = [...visible]
    .map((id) => storeNodes[id])
    .filter((node): node is InternetNode => Boolean(node))
  const edges = Object.values(storeEdges).filter(
    (edge) =>
      visible.has(edge.source) &&
      visible.has(edge.target) &&
      isEdgeVisible(edge, filters.hiddenEdgeTypes, filters.minConfidence),
  )
  return { group, nodes, edges }
}
