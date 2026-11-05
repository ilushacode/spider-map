import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
  type EdgeMouseHandler,
  type Node,
  type NodeMouseHandler,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { ArrowLeft, Crosshair, Maximize2, RefreshCw } from 'lucide-react'
import { useGraphStore } from '../../graph/graph-store'
import type {
  Confidence,
  EdgeType,
  InternetEdge,
  InternetNode,
  NodeType,
} from '../../graph/types'
import InternetNodeView from './InternetNodeView'
import GroupNodeView, { type GroupFlowNode } from './GroupNodeView'
import { GRAPH_GROUPS, getGraphGroup, type GraphGroupId } from './groups'
import { layoutGraph } from './graph-layout'
import { EDGE_LABELS, NODE_VISUALS } from './node-visuals'

const CONFIDENCE_RANK: Record<Confidence, number> = {
  unknown: 0,
  inferred: 1,
  observed: 2,
  corroborated: 3,
  authoritative: 4,
}

const NODE_TYPES_MAP = { internet: InternetNodeView, group: GroupNodeView }

function isNodeVisible(
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

function isEdgeVisible(
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

function buildAdjacency(edges: InternetEdge[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>()
  for (const edge of edges) {
    if (!map.has(edge.source)) map.set(edge.source, new Set())
    if (!map.has(edge.target)) map.set(edge.target, new Set())
    map.get(edge.source)?.add(edge.target)
    map.get(edge.target)?.add(edge.source)
  }
  return map
}

function reachableFrom(start: string, adjacency: Map<string, Set<string>>): Set<string> {
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

function pathToRoots(
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

function GraphCanvas() {
  const storeNodes = useGraphStore((state) => state.nodes)
  const storeEdges = useGraphStore((state) => state.edges)
  const filters = useGraphStore((state) => state.filters)
  const selectedNodeId = useGraphStore((state) => state.selectedNodeId)
  const selectedEdgeId = useGraphStore((state) => state.selectedEdgeId)
  const setSelectedNode = useGraphStore((state) => state.setSelectedNode)
  const setSelectedEdge = useGraphStore((state) => state.setSelectedEdge)
  const investigation = useGraphStore((state) => state.investigation)

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<Node>([])
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [layoutVersion, setLayoutVersion] = useState(0)
  const { fitView } = useReactFlow()

  const rootIds = useMemo(() => {
    const ids = investigation?.rootNodeIds ?? []
    if (ids.length > 0) return ids
    return investigation?.rootNodeId ? [investigation.rootNodeId] : []
  }, [investigation])
  const rootKey = rootIds.join('|')

  const [focus, setFocus] = useState<{ group: GraphGroupId; rootsKey: string } | null>(null)
  const focusGroup = focus && focus.rootsKey === rootKey ? focus.group : null
  const setFocusGroup = useCallback(
    (group: GraphGroupId | null) => {
      setFocus(group ? { group, rootsKey: rootKey } : null)
    },
    [rootKey],
  )

  const adjacency = useMemo(() => buildAdjacency(Object.values(storeEdges)), [storeEdges])

  const reachableByRoot = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const rootId of rootIds) map.set(rootId, reachableFrom(rootId, adjacency))
    return map
  }, [adjacency, rootIds])

  const allReachable = useMemo(() => {
    const set = new Set<string>(rootIds)
    for (const reachable of reachableByRoot.values()) {
      for (const id of reachable) set.add(id)
    }
    return set
  }, [reachableByRoot, rootIds])

  const groups = useMemo(
    () =>
      GRAPH_GROUPS.map((group) => {
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
        const rootCounts = rootIds
          .map((rootId) => ({
            rootId,
            count: nodes.filter((node) => reachableByRoot.get(rootId)?.has(node.id)).length,
          }))
          .filter((item) => item.count > 0)
        return { group, nodes, shared, rootCounts }
      }).filter((item) => item.nodes.length > 0),
    [allReachable, storeNodes, rootIds, reachableByRoot],
  )

  const categoryView = useMemo(() => {
    if (!focusGroup) return null
    const group = getGraphGroup(focusGroup)
    const categoryNodes = [...allReachable]
      .map((id) => storeNodes[id])
      .filter(
        (node): node is InternetNode =>
          Boolean(node) &&
          group.types.includes(node.type) &&
          isNodeVisible(node, filters.hiddenNodeTypes, filters.hiddenNodeIds, filters.search, filters.minConfidence),
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
  }, [focusGroup, allReachable, storeNodes, rootIds, filters, adjacency, storeEdges])

  const neighbours = useMemo(() => {
    if (!selectedNodeId) return null
    const set = new Set<string>([selectedNodeId])
    for (const edge of Object.values(storeEdges)) {
      if (edge.source === selectedNodeId) set.add(edge.target)
      if (edge.target === selectedNodeId) set.add(edge.source)
    }
    return set
  }, [selectedNodeId, storeEdges])

  useEffect(() => {
    if (categoryView) {
      const layout = layoutGraph(categoryView.nodes, categoryView.edges)
      setRfNodes(
        categoryView.nodes.map((node) => ({
          id: node.id,
          type: 'internet',
          position: layout.get(node.id) ?? { x: 0, y: 0 },
          selected: node.id === selectedNodeId,
          data: {
            node,
            dimmed: Boolean(neighbours && !neighbours.has(node.id)),
          },
        })),
      )
      setRfEdges(
        categoryView.edges.map((edge) => {
          const connected = Boolean(
            selectedNodeId && (edge.source === selectedNodeId || edge.target === selectedNodeId),
          )
          return {
            id: edge.id,
            source: edge.source,
            target: edge.target,
            label: EDGE_LABELS[edge.type],
            type: 'smoothstep',
            selected: edge.id === selectedEdgeId,
            animated: connected,
            className: `net-edge${connected ? ' is-connected' : ''}`,
            markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
            labelStyle: { fill: '#8f96a5', fontSize: 10, fontFamily: 'var(--mono)' },
            labelBgStyle: { fill: '#0f1116', fillOpacity: 0.9 },
            style: {
              stroke: connected ? '#d6a35c' : 'rgba(232,235,242,0.2)',
              strokeWidth: connected ? 1.6 : 1,
            },
            data: { edge },
          }
        }),
      )
      return
    }

    const rootNodes = rootIds
      .map((id) => storeNodes[id])
      .filter((node): node is InternetNode => Boolean(node))
    const groupedNodes: Node[] = groups.map((item, index) => ({
      id: `group:${item.group.id}`,
      type: 'group',
      position: {
        x: 360,
        y: index * 96 - (groups.length - 1) * 48,
      },
      data: {
        groupId: item.group.id,
        label: item.group.label,
        count: item.nodes.length,
        shared: item.shared,
        color: item.group.color,
        icon: item.group.icon,
      } satisfies GroupFlowNode['data'],
    }))

    const rootFlowNodes: Node[] = rootNodes.map((node, index) => ({
      id: node.id,
      type: 'internet',
      position: {
        x: 0,
        y: index * 120 - (rootNodes.length - 1) * 60,
      },
      selected: node.id === selectedNodeId,
      data: { node, dimmed: false },
    }))

    const groupEdges: Edge[] = groups.flatMap((item) =>
      item.rootCounts.map((rootCount) => ({
        id: `group-edge:${rootCount.rootId}:${item.group.id}`,
        source: rootCount.rootId,
        target: `group:${item.group.id}`,
        label: String(rootCount.count),
        type: 'smoothstep',
        style: {
          stroke: 'rgba(232,235,242,0.24)',
          strokeDasharray: '5 5',
          strokeWidth: 1,
        },
        labelStyle: { fill: '#8f96a5', fontSize: 10, fontFamily: 'var(--mono)' },
        labelBgStyle: { fill: '#0f1116', fillOpacity: 0.9 },
      })),
    )

    setRfNodes([...rootFlowNodes, ...groupedNodes])
    setRfEdges(groupEdges)
  }, [
    categoryView,
    groups,
    rootIds,
    storeNodes,
    selectedNodeId,
    selectedEdgeId,
    neighbours,
    layoutVersion,
    setRfNodes,
    setRfEdges,
  ])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fitView({ padding: 0.24, duration: 300 })
    }, 80)
    return () => window.clearTimeout(timer)
  }, [focusGroup, rootKey, investigation?.status, fitView])

  const onNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      if (node.type === 'group') {
        const groupId = (node.data as GroupFlowNode['data']).groupId
        setFocusGroup(groupId)
        setSelectedNode(null)
        return
      }
      setSelectedNode(node.id)
    },
    [setSelectedNode, setFocusGroup],
  )
  const onEdgeClick: EdgeMouseHandler = useCallback(
    (_event, edge) => setSelectedEdge(edge.id),
    [setSelectedEdge],
  )
  const onPaneClick = useCallback(() => {
    setSelectedNode(null)
    setSelectedEdge(null)
  }, [setSelectedNode, setSelectedEdge])

  const focusRoot = useCallback(() => {
    const id = rootIds[rootIds.length - 1] ?? rootIds[0]
    if (!id) return
    void fitView({ nodes: [{ id }], duration: 400, padding: 1.4 })
  }, [fitView, rootIds])

  const relayout = useCallback(() => setLayoutVersion((version) => version + 1), [])

  return (
    <ReactFlow
      nodes={rfNodes}
      edges={rfEdges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={onNodeClick}
      onEdgeClick={onEdgeClick}
      onPaneClick={onPaneClick}
      nodeTypes={NODE_TYPES_MAP}
      minZoom={0.12}
      maxZoom={1.8}
      fitView
      fitViewOptions={{ padding: 0.24 }}
      nodesConnectable={false}
      className="graph-canvas"
    >
      <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="rgba(255,255,255,0.06)" />
      <Controls showInteractive={false} position="bottom-left" />
      <MiniMap
        pannable
        zoomable
        position="bottom-right"
        nodeColor={(node) => {
          const data = node.data as { color?: string; node?: InternetNode }
          if (data.color) return data.color
          return data.node ? NODE_VISUALS[data.node.type].color : '#5f6673'
        }}
        maskColor="rgba(7,8,11,0.78)"
        style={{ background: '#0d0f14', border: '1px solid rgba(255,255,255,0.08)' }}
      />
      {focusGroup ? (
        <Panel position="top-left" className="graph-breadcrumb">
          <button type="button" className="graph-breadcrumb__back" onClick={() => setFocusGroup(null)}>
            <ArrowLeft size={14} strokeWidth={1.5} />
            Все категории
          </button>
          <span className="graph-breadcrumb__current">{getGraphGroup(focusGroup).label}</span>
        </Panel>
      ) : null}
      <Panel position="top-right" className="graph-panel">
        <button type="button" className="icon-button" onClick={focusRoot} title="Центрировать на исходном объекте">
          <Crosshair size={16} strokeWidth={1.5} />
        </button>
        <button type="button" className="icon-button" onClick={() => void fitView({ padding: 0.2, duration: 400 })} title="Показать весь граф">
          <Maximize2 size={16} strokeWidth={1.5} />
        </button>
        <button type="button" className="icon-button" onClick={relayout} title="Перестроить раскладку">
          <RefreshCw size={16} strokeWidth={1.5} />
        </button>
      </Panel>
    </ReactFlow>
  )
}

export default function GraphView() {
  return (
    <ReactFlowProvider>
      <GraphCanvas />
    </ReactFlowProvider>
  )
}
