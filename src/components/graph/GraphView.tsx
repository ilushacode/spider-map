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
  type NodeMouseHandler,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Crosshair, Maximize2, RefreshCw } from 'lucide-react'
import { useGraphStore } from '../../graph/graph-store'
import type { Confidence, EdgeType, InternetEdge, InternetNode, NodeType } from '../../graph/types'
import InternetNodeView, { type InternetFlowNode } from './InternetNodeView'
import { layoutGraph } from './graph-layout'
import { EDGE_LABELS, NODE_VISUALS } from './node-visuals'

const CONFIDENCE_RANK: Record<Confidence, number> = {
  unknown: 0,
  inferred: 1,
  observed: 2,
  corroborated: 3,
  authoritative: 4,
}

function isNodeVisible(
  node: InternetNode,
  hidden: NodeType[],
  search: string,
  minConfidence: Confidence | 'all',
): boolean {
  if (hidden.includes(node.type)) return false
  if (minConfidence !== 'all' && CONFIDENCE_RANK[node.sources[0]?.confidence ?? 'unknown'] < CONFIDENCE_RANK[minConfidence]) {
    return false
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

function GraphCanvas() {
  const storeNodes = useGraphStore((state) => state.nodes)
  const storeEdges = useGraphStore((state) => state.edges)
  const filters = useGraphStore((state) => state.filters)
  const selectedNodeId = useGraphStore((state) => state.selectedNodeId)
  const selectedEdgeId = useGraphStore((state) => state.selectedEdgeId)
  const setSelectedNode = useGraphStore((state) => state.setSelectedNode)
  const setSelectedEdge = useGraphStore((state) => state.setSelectedEdge)
  const rootNodeId = useGraphStore((state) => state.investigation?.rootNodeId ?? null)

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<InternetFlowNode>([])
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [layoutVersion, setLayoutVersion] = useState(0)
  const { fitView } = useReactFlow()

  const { visibleNodeIds, visibleEdges } = useMemo(() => {
    const nodeIds = new Set<string>()
    for (const node of Object.values(storeNodes)) {
      if (isNodeVisible(node, filters.hiddenNodeTypes, filters.search, filters.minConfidence)) {
        nodeIds.add(node.id)
      }
    }
    const edges = Object.values(storeEdges).filter(
      (edge) =>
        nodeIds.has(edge.source) &&
        nodeIds.has(edge.target) &&
        isEdgeVisible(edge, filters.hiddenEdgeTypes, filters.minConfidence),
    )
    return { visibleNodeIds: nodeIds, visibleEdges: edges }
  }, [storeNodes, storeEdges, filters])

  const neighbours = useMemo(() => {
    if (!selectedNodeId) return null
    const set = new Set<string>([selectedNodeId])
    for (const edge of visibleEdges) {
      if (edge.source === selectedNodeId) set.add(edge.target)
      if (edge.target === selectedNodeId) set.add(edge.source)
    }
    return set
  }, [selectedNodeId, visibleEdges])

  useEffect(() => {
    const nodes = [...visibleNodeIds]
      .map((id) => storeNodes[id])
      .filter((node): node is InternetNode => Boolean(node))
    const layout = layoutGraph(nodes, visibleEdges)

    setRfNodes((current) => {
      const positions = new Map(current.map((node) => [node.id, node.position]))
      return nodes.map((node) => ({
        id: node.id,
        type: 'internet',
        position: positions.get(node.id) ?? layout.get(node.id) ?? { x: 0, y: 0 },
        selected: node.id === selectedNodeId,
        data: {
          node,
          dimmed: Boolean(neighbours && !neighbours.has(node.id)),
        },
      }))
    })

    setRfEdges(
      visibleEdges.map((edge) => {
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
  }, [
    visibleNodeIds,
    visibleEdges,
    storeNodes,
    selectedNodeId,
    selectedEdgeId,
    neighbours,
    layoutVersion,
    setRfNodes,
    setRfEdges,
  ])

  const onNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => setSelectedNode(node.id),
    [setSelectedNode],
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
    if (!rootNodeId) return
    void fitView({ nodes: [{ id: rootNodeId }], duration: 400, padding: 1.4 })
  }, [fitView, rootNodeId])

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
      nodeTypes={{ internet: InternetNodeView }}
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
        nodeColor={(node) => NODE_VISUALS[(node as InternetFlowNode).data.node.type].color}
        maskColor="rgba(7,8,11,0.78)"
        style={{ background: '#0d0f14', border: '1px solid rgba(255,255,255,0.08)' }}
      />
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
