import { useState } from 'react'
import { useGraphStore } from '../../graph/graph-store'
import type { InternetNode, NodeType } from '../../graph/types'
import { NODE_VISUALS } from '../graph/node-visuals'

type Group = 'dns' | 'network' | 'routing' | 'registration' | 'certificates' | 'geography'

const GROUPS: Record<Group, { label: string; types: NodeType[] }> = {
  dns: { label: 'DNS', types: ['dns-record', 'nameserver', 'mail-server'] },
  network: { label: 'Сети и ASN', types: ['ip', 'prefix', 'asn', 'network', 'exchange-point'] },
  routing: { label: 'Маршрутизация', types: ['route-collector', 'bgp-peer'] },
  registration: { label: 'Регистрация', types: ['registrar', 'organization', 'rir'] },
  certificates: { label: 'Сертификаты', types: ['certificate'] },
  geography: { label: 'География', types: ['geographic-location'] },
}

function matchesGroup(node: InternetNode, group: Group): boolean {
  if (GROUPS[group].types.includes(node.type)) return true
  if (group === 'geography' && node.type === 'ip' && node.metadata.country) return true
  return false
}

export default function DataSections() {
  const [group, setGroup] = useState<Group>('dns')
  const nodes = useGraphStore((state) => state.nodes)
  const setSelectedNode = useGraphStore((state) => state.setSelectedNode)

  const allNodes = Object.values(nodes)
  const visible = allNodes.filter((node) => matchesGroup(node, group))

  return (
    <section className="panel-section">
      <header className="panel-section__header">
        <h2>Данные</h2>
        <span className="mono muted">{visible.length}</span>
      </header>

      <div className="subtab-row">
        {(Object.keys(GROUPS) as Group[]).map((id) => (
          <button
            key={id}
            type="button"
            className={`subtab${group === id ? ' is-active' : ''}`}
            onClick={() => setGroup(id)}
          >
            {GROUPS[id].label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="muted small">
          Нет данных в этом разделе. Это не означает отсутствие объекта: источник мог не ответить
          или не вернуть соответствующие поля.
        </p>
      ) : (
        <ul className="data-list">
          {visible.slice(0, 120).map((node) => {
            const visual = NODE_VISUALS[node.type]
            const country = typeof node.metadata.country === 'string' ? node.metadata.country : undefined
            return (
              <li key={node.id}>
                <button type="button" className="data-row" onClick={() => setSelectedNode(node.id)}>
                  <span className="legend-dot" style={{ background: visual.color }} />
                  <span className="data-row__name">{node.label}</span>
                  <span className="data-row__meta">{country ?? visual.label}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
