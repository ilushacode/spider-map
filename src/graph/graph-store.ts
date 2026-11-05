import { create } from 'zustand'
import { mergeEdges, mergeNodes } from './deduplicate'
import type {
  EdgeType,
  GraphFilters,
  GraphSnapshot,
  InternetEdge,
  InternetNode,
  Investigation,
  NodeLoadState,
  NodeType,
  SourceResult,
} from './types'

interface GraphState {
  nodes: Record<string, InternetNode>
  edges: Record<string, InternetEdge>
  investigation: Investigation | null
  selectedNodeId: string | null
  selectedEdgeId: string | null
  filters: GraphFilters
  addNode: (node: InternetNode) => void
  addEdge: (edge: InternetEdge) => void
  addGraph: (nodes: InternetNode[], edges: InternetEdge[]) => void
  setNodeLoadState: (id: string, state: NodeLoadState, error?: string) => void
  setInvestigation: (investigation: Investigation | null) => void
  updateInvestigation: (patch: Partial<Investigation>) => void
  setSourceResult: (key: string, result: SourceResult<unknown>) => void
  setSelectedNode: (id: string | null) => void
  setSelectedEdge: (id: string | null) => void
  setFilters: (patch: Partial<GraphFilters>) => void
  toggleNodeType: (type: NodeType) => void
  toggleEdgeType: (type: EdgeType) => void
  hideNodes: (ids: string[]) => void
  showNode: (id: string) => void
  resetFilters: () => void
  reset: () => void
  loadSnapshot: (snapshot: GraphSnapshot) => void
}

const DEFAULT_FILTERS: GraphFilters = {
  hiddenNodeTypes: [],
  hiddenEdgeTypes: [],
  hiddenNodeIds: [],
  search: '',
  minConfidence: 'all',
}

function withCounts(
  investigation: Investigation | null,
  nodes: Record<string, InternetNode>,
  edges: Record<string, InternetEdge>,
): Investigation | null {
  if (!investigation) return null
  const results = Object.values(investigation.sourceResults)
  return {
    ...investigation,
    counts: {
      ...investigation.counts,
      nodes: Object.keys(nodes).length,
      edges: Object.keys(edges).length,
      sourcesOk: results.filter((result) => result.status === 'ok').length,
      sourcesPartial: results.filter((result) => result.status === 'partial').length,
      sourcesFailed: results.filter(
        (result) => result.status === 'error' || result.status === 'unsupported',
      ).length,
    },
  }
}

export const useGraphStore = create<GraphState>()((set) => ({
  nodes: {},
  edges: {},
  investigation: null,
  selectedNodeId: null,
  selectedEdgeId: null,
  filters: DEFAULT_FILTERS,

  addNode: (node) =>
    set((state) => {
      const existing = state.nodes[node.id]
      const merged = existing ? mergeNodes(existing, node) : node
      const nodes = { ...state.nodes, [node.id]: merged }
      return { nodes, investigation: withCounts(state.investigation, nodes, state.edges) }
    }),

  addEdge: (edge) =>
    set((state) => {
      if (!state.nodes[edge.source] || !state.nodes[edge.target]) return state
      const existing = state.edges[edge.id]
      const merged = existing ? mergeEdges(existing, edge) : edge
      const edges = { ...state.edges, [edge.id]: merged }
      return { edges, investigation: withCounts(state.investigation, state.nodes, edges) }
    }),

  addGraph: (nodes, edges) =>
    set((state) => {
      const nextNodes = { ...state.nodes }
      for (const node of nodes) {
        const existing = nextNodes[node.id]
        nextNodes[node.id] = existing ? mergeNodes(existing, node) : node
      }
      const nextEdges = { ...state.edges }
      for (const edge of edges) {
        if (!nextNodes[edge.source] || !nextNodes[edge.target]) continue
        const existing = nextEdges[edge.id]
        nextEdges[edge.id] = existing ? mergeEdges(existing, edge) : edge
      }
      return {
        nodes: nextNodes,
        edges: nextEdges,
        investigation: withCounts(state.investigation, nextNodes, nextEdges),
      }
    }),

  setNodeLoadState: (id, loadState, error) =>
    set((state) => {
      const node = state.nodes[id]
      if (!node) return state
      return {
        nodes: {
          ...state.nodes,
          [id]: {
            ...node,
            loadState,
            lastUpdated: new Date().toISOString(),
            errors: error ? [...new Set([...node.errors, error])] : node.errors,
          },
        },
      }
    }),

  setInvestigation: (investigation) => set({ investigation }),

  updateInvestigation: (patch) =>
    set((state) => ({
      investigation: state.investigation ? { ...state.investigation, ...patch } : null,
    })),

  setSourceResult: (key, result) =>
    set((state) => {
      if (!state.investigation) return state
      const sourceResults = { ...state.investigation.sourceResults, [key]: result }
      const investigation = { ...state.investigation, sourceResults }
      return { investigation: withCounts(investigation, state.nodes, state.edges) }
    }),

  setSelectedNode: (id) => set({ selectedNodeId: id, selectedEdgeId: null }),
  setSelectedEdge: (id) => set({ selectedEdgeId: id, selectedNodeId: null }),

  setFilters: (patch) => set((state) => ({ filters: { ...state.filters, ...patch } })),

  toggleNodeType: (type) =>
    set((state) => {
      const hidden = state.filters.hiddenNodeTypes.includes(type)
        ? state.filters.hiddenNodeTypes.filter((item) => item !== type)
        : [...state.filters.hiddenNodeTypes, type]
      return { filters: { ...state.filters, hiddenNodeTypes: hidden } }
    }),

  toggleEdgeType: (type) =>
    set((state) => {
      const hidden = state.filters.hiddenEdgeTypes.includes(type)
        ? state.filters.hiddenEdgeTypes.filter((item) => item !== type)
        : [...state.filters.hiddenEdgeTypes, type]
      return { filters: { ...state.filters, hiddenEdgeTypes: hidden } }
    }),

  hideNodes: (ids) =>
    set((state) => ({
      filters: {
        ...state.filters,
        hiddenNodeIds: [...new Set([...state.filters.hiddenNodeIds, ...ids])],
      },
    })),

  showNode: (id) =>
    set((state) => ({
      filters: {
        ...state.filters,
        hiddenNodeIds: state.filters.hiddenNodeIds.filter((item) => item !== id),
      },
    })),

  resetFilters: () => set({ filters: DEFAULT_FILTERS }),

  reset: () =>
    set({
      nodes: {},
      edges: {},
      investigation: null,
      selectedNodeId: null,
      selectedEdgeId: null,
      filters: DEFAULT_FILTERS,
    }),

  loadSnapshot: (snapshot) =>
    set({
      nodes: Object.fromEntries(snapshot.nodes.map((node) => [node.id, node])),
      edges: Object.fromEntries(snapshot.edges.map((edge) => [edge.id, edge])),
      investigation: snapshot.investigation,
      selectedNodeId: null,
      selectedEdgeId: null,
      filters: DEFAULT_FILTERS,
    }),
}))
