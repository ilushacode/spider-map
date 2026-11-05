import { memo, type CSSProperties } from 'react'
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import type { LucideIcon } from 'lucide-react'
import type { GraphGroupId } from './groups'

export type GroupFlowNode = Node<
  {
    groupId: GraphGroupId
    label: string
    count: number
    shared: number
    color: string
    icon: LucideIcon
  },
  'group'
>

function GroupNodeView({ data, selected }: NodeProps<GroupFlowNode>) {
  const Icon = data.icon
  const style = { '--node-color': data.color } as CSSProperties
  return (
    <div className={`group-node${selected ? ' is-selected' : ''}`} style={style}>
      <Handle type="target" position={Position.Left} className="net-handle" />
      <div className="group-node__icon">
        <Icon size={16} strokeWidth={1.5} aria-hidden="true" />
      </div>
      <div className="group-node__body">
        <span className="group-node__label">{data.label}</span>
        <span className="group-node__meta">
          {data.count} {data.shared > 0 ? `· общих ${data.shared}` : ''}
        </span>
      </div>
      <span className="group-node__count">{data.count}</span>
      <Handle type="source" position={Position.Right} className="net-handle" />
    </div>
  )
}

export default memo(GroupNodeView)
