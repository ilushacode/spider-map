import { useMemo, useState } from 'react'
import { Check, Copy, ExternalLink, GitBranch, X } from 'lucide-react'
import { useGraphStore } from '../../graph/graph-store'
import { expandNode } from '../../features/investigation/orchestrator'
import { CONFIDENCE_LABELS, LOAD_STATE_LABELS, NODE_VISUALS } from '../graph/node-visuals'
import { EDGE_LABELS } from '../graph/node-visuals'

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'object' ? JSON.stringify(item) : String(item)))
      .join(', ')
  }
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function MetadataList({ metadata }: { metadata: Record<string, unknown> }) {
  const entries = Object.entries(metadata).filter(
    ([key, value]) =>
      value !== undefined &&
      value !== null &&
      !['rpki', 'prefixCount', 'registrationEvents'].includes(key),
  )
  if (entries.length === 0) return null
  return (
    <dl className="detail-list">
      {entries.map(([key, value]) => (
        <div key={key} className="detail-row">
          <dt>{key}</dt>
          <dd>{formatValue(value)}</dd>
        </div>
      ))}
    </dl>
  )
}

export default function NodeDetailsPanel() {
  const selectedNodeId = useGraphStore((state) => state.selectedNodeId)
  const node = useGraphStore((state) => (selectedNodeId ? state.nodes[selectedNodeId] : undefined))
  const edges = useGraphStore((state) => state.edges)
  const nodes = useGraphStore((state) => state.nodes)
  const setSelectedNode = useGraphStore((state) => state.setSelectedNode)
  const [copied, setCopied] = useState(false)
  const [expanding, setExpanding] = useState(false)

  const related = useMemo(() => {
    if (!node) return []
    return Object.values(edges)
      .filter((edge) => edge.source === node.id || edge.target === node.id)
      .map((edge) => {
        const otherId = edge.source === node.id ? edge.target : edge.source
        return { edge, other: nodes[otherId] }
      })
      .filter((item) => Boolean(item.other))
  }, [edges, node, nodes])

  if (!node) return null

  const visual = NODE_VISUALS[node.type]
  const Icon = visual.icon

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(node.identifier)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1400)
    } catch {
      setCopied(false)
    }
  }

  const expand = async () => {
    if (expanding) return
    setExpanding(true)
    const controller = new AbortController()
    try {
      await expandNode(node.id, controller.signal)
    } finally {
      setExpanding(false)
    }
  }

  return (
    <aside className="details-panel" aria-label="Информация об узле">
      <header className="details-header">
        <div className="details-title">
          <span className="details-icon" style={{ color: visual.color }}>
            <Icon size={16} strokeWidth={1.5} />
          </span>
          <div>
            <span className="details-type">{visual.label}</span>
            <h2>{node.label}</h2>
          </div>
        </div>
        <button type="button" className="icon-button" onClick={() => setSelectedNode(null)} aria-label="Закрыть">
          <X size={16} strokeWidth={1.5} />
        </button>
      </header>

      <div className="details-body">
        <div className="identifier-row">
          <code>{node.identifier}</code>
          <button type="button" className="icon-button" onClick={() => void copy()} title="Скопировать идентификатор">
            {copied ? <Check size={15} strokeWidth={1.5} /> : <Copy size={15} strokeWidth={1.5} />}
          </button>
        </div>

        <div className="details-badges">
          <span className={`state-badge is-${node.loadState}`}>{LOAD_STATE_LABELS[node.loadState]}</span>
          <span className="state-badge">{node.completeness}</span>
          <span className="state-badge">{node.sources.length} источн.</span>
        </div>

        {node.description ? <p className="details-description">{node.description}</p> : null}

        <section className="details-section">
          <h3>Данные</h3>
          <MetadataList metadata={node.metadata} />
        </section>

        <section className="details-section">
          <h3>Связи</h3>
          {related.length === 0 ? (
            <p className="muted small">Связей пока нет</p>
          ) : (
            <ul className="related-list">
              {related.slice(0, 40).map(({ edge, other }) => (
                <li key={edge.id}>
                  <button type="button" className="related-row" onClick={() => setSelectedNode(other.id)}>
                    <span className="related-edge">{EDGE_LABELS[edge.type]}</span>
                    <span className="related-name">{other.label}</span>
                    <span className={`status-dot is-${edge.confidence === 'authoritative' ? 'ok' : 'partial'}`} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="details-section">
          <h3>Источники</h3>
          <ul className="evidence-list">
            {node.sources.map((evidence, index) => (
              <li key={`${evidence.url}-${index}`}>
                <a href={evidence.url} target="_blank" rel="noreferrer">
                  <span>{evidence.sourceName}</span>
                  <span className="evidence-meta">
                    {CONFIDENCE_LABELS[evidence.confidence]}
                    <ExternalLink size={12} strokeWidth={1.5} />
                  </span>
                </a>
              </li>
            ))}
            {node.sources.length === 0 ? <li className="muted small">Источник не указан</li> : null}
          </ul>
        </section>

        {node.errors.length > 0 ? (
          <section className="details-section">
            <h3>Ошибки</h3>
            <ul className="error-list">
              {node.errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <details className="raw-details">
          <summary>Исходные данные</summary>
          <pre>{JSON.stringify(node, null, 2)}</pre>
        </details>

        <button type="button" className="primary-button" onClick={() => void expand()} disabled={expanding}>
          <GitBranch size={15} strokeWidth={1.5} />
          {expanding ? 'Раскрываю…' : 'Раскрыть связи'}
        </button>
      </div>
    </aside>
  )
}
