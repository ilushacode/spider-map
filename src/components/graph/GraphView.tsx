import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  useNodesInitialized,
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
import type { InternetNode } from '../../graph/types'
import InternetNodeView from './InternetNodeView'
import GroupNodeView, { type GroupFlowNode } from './GroupNodeView'
import { GRAPH_GROUPS, getGraphGroup, type GraphGroupId } from './groups'
import { layoutGraph } from './graph-layout'
import { EDGE_LABELS, NODE_VISUALS } from './node-visuals'
import {
  buildAdjacency,
  computeCategoryView,
  computeGroups,
  reachableFrom,
} from './view-model'

const NODE_TYPES_MAP = { internet: InternetNodeView, group: GroupNodeView }

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
  const [pendingEdges, setPendingEdges] = useState<Edge[]>([])
  const [layoutVersion, setLayoutVersion] = useState(0)
  const [readyNodeSignature, setReadyNodeSignature] = useState('')
  const { fitView } = useReactFlow()
  const nodesInitialized = useNodesInitialized()
  const lastFitKeyRef = useRef('')
  const lastNodeSignatureRef = useRef('')
  const lastEdgeSignatureRef = useRef('')
  const appliedEdgeSignatureRef = useRef('')
  const lastLayoutVersionRef = useRef(0)
  const lastFocusRef = useRef<GraphGroupId | null>(null)

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

  const groups = useMemo(
    () => computeGroups(storeNodes, rootIds, reachableByRoot, GRAPH_GROUPS),
    [storeNodes, rootIds, reachableByRoot],
  )

  const categoryView = useMemo(
    () =>
      focusGroup
        ? computeCategoryView(
            storeNodes,
            storeEdges,
            rootIds,
            adjacency,
            getGraphGroup(focusGroup),
            filters,
          )
        : null,
    [focusGroup, storeNodes, storeEdges, rootIds, adjacency, filters],
  )

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
    const nodeSignature = categoryView
      ? JSON.stringify(
          categoryView.nodes.map((node) => [
            node.id,
            node.id === selectedNodeId,
            Boolean(neighbours && !neighbours.has(node.id)),
          ]),
        )
      : JSON.stringify({
          roots: rootIds,
          groups: groups.map((item) => [
            item.group.id,
            item.nodes.length,
            item.shared,
            item.group.label,
          ]),
          selected: selectedNodeId,
        })

    if (nodeSignature !== lastNodeSignatureRef.current) {
      lastNodeSignatureRef.current = nodeSignature
      setReadyNodeSignature('')

      if (categoryView) {
        const forceLayout = lastLayoutVersionRef.current !== layoutVersion
        if (forceLayout) lastLayoutVersionRef.current = layoutVersion
        const focusChanged = lastFocusRef.current !== focusGroup
        if (focusChanged) lastFocusRef.current = focusGroup
        const useLayoutForAll = forceLayout || focusChanged
        const layout = layoutGraph(categoryView.nodes, categoryView.edges)
        setRfNodes((current) => {
          const positions = new Map(current.map((node) => [node.id, node.position]))
          return categoryView.nodes.map((node) => ({
            id: node.id,
            type: 'internet',
            position:
              useLayoutForAll
                ? (layout.get(node.id) ?? { x: 0, y: 0 })
                : (positions.get(node.id) ?? layout.get(node.id) ?? { x: 0, y: 0 }),
            selected: node.id === selectedNodeId,
            data: {
              node,
              dimmed: Boolean(neighbours && !neighbours.has(node.id)),
            },
          }))
        })
      } else {
        const rootNodes = rootIds
          .map((id) => storeNodes[id])
          .filter((node): node is InternetNode => Boolean(node))
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
        setRfNodes([...rootFlowNodes, ...groupedNodes])
      }
    }

    const desiredEdges: Edge[] = categoryView
      ? categoryView.edges.map((edge) => {
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
        })
      : []
    const edgeSignature = JSON.stringify(
      desiredEdges.map((edge) => [
        edge.id,
        edge.source,
        edge.target,
        edge.selected,
        edge.animated,
      ]),
    )
    if (edgeSignature !== lastEdgeSignatureRef.current) {
      lastEdgeSignatureRef.current = edgeSignature
      setPendingEdges(desiredEdges)
    }
  }, [
    categoryView,
    groups,
    rootIds,
    storeNodes,
    selectedNodeId,
    selectedEdgeId,
    neighbours,
    layoutVersion,
    focusGroup,
    setRfNodes,
  ])

  useEffect(() => {
    if (!nodesInitialized) return
    const timer = window.setTimeout(() => {
      setReadyNodeSignature(lastNodeSignatureRef.current)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [rfNodes, nodesInitialized])

  useEffect(() => {
    if (!nodesInitialized) return
    if (readyNodeSignature !== lastNodeSignatureRef.current) return
    const nodeIds = new Set(rfNodes.map((node) => node.id))
    if (!pendingEdges.every((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))) {
      return
    }
    const signature = JSON.stringify(
      pendingEdges.map((edge) => [edge.id, edge.source, edge.target, edge.selected, edge.animated]),
    )
    if (signature === appliedEdgeSignatureRef.current) return
    appliedEdgeSignatureRef.current = signature
    setRfEdges(pendingEdges)
  }, [pendingEdges, rfNodes, nodesInitialized, readyNodeSignature, setRfEdges])

  useEffect(() => {
    if (!nodesInitialized) return
    const status = investigation?.status
    const finished =
      status === 'complete' ||
      status === 'partial' ||
      status === 'cancelled' ||
      status === 'error'
    const fitKey = `${rootKey}:${focusGroup ?? ''}`
    const rootChanged = lastFitKeyRef.current !== fitKey
    if (!finished && !rootChanged) return
    lastFitKeyRef.current = fitKey
    const timer = window.setTimeout(() => {
      void fitView({ padding: 0.24, duration: 300 })
    }, 80)
    return () => window.clearTimeout(timer)
  }, [focusGroup, rootKey, investigation?.status, nodesInitialized, fitView])

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
