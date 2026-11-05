import { memo, type CSSProperties } from 'react'
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import type { InternetNode } from '../../graph/types'
import { LOAD_STATE_LABELS, NODE_VISUALS } from './node-visuals'

export type InternetFlowNode = Node<
  { node: InternetNode; dimmed: boolean },
  'internet'
>

function InternetNodeView({ data, selected }: NodeProps<InternetFlowNode>) {
  const { node, dimmed } = data
  const visual = NODE_VISUALS[node.type]
  const Icon = visual.icon
  const style = { '--node-color': visual.color } as CSSProperties

  return (
    <div
      className={`net-node${selected ? ' is-selected' : ''}${dimmed ? ' is-dimmed' : ''}`}
      style={style}
      data-type={node.type}
    >
      <Handle type="target" position={Position.Left} className="net-handle" />
      <div className="net-node__icon">
        <Icon size={16} strokeWidth={1.5} aria-hidden="true" />
      </div>
      <div className="net-node__body">
        <div className="net-node__label" title={node.label}>
          {node.label}
        </div>
        <div className="net-node__meta">
          <span>{visual.label}</span>
          {node.childCount !== undefined && node.childCount > 0 ? (
            <span className="net-node__count">{node.childCount}</span>
          ) : null}
        </div>
      </div>
      <span
        className={`net-node__state is-${node.loadState}`}
        title={LOAD_STATE_LABELS[node.loadState]}
        aria-label={LOAD_STATE_LABELS[node.loadState]}
      />
      <Handle type="source" position={Position.Right} className="net-handle" />
    </div>
  )
}

export default memo(InternetNodeView)
