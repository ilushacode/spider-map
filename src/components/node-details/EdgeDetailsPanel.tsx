import { ArrowRight, ExternalLink, X } from 'lucide-react'
import { useGraphStore } from '../../graph/graph-store'
import { CONFIDENCE_LABELS, EDGE_LABELS } from '../graph/node-visuals'

export default function EdgeDetailsPanel() {
  const selectedEdgeId = useGraphStore((state) => state.selectedEdgeId)
  const edge = useGraphStore((state) => (selectedEdgeId ? state.edges[selectedEdgeId] : undefined))
  const nodes = useGraphStore((state) => state.nodes)
  const setSelectedEdge = useGraphStore((state) => state.setSelectedEdge)
  const setSelectedNode = useGraphStore((state) => state.setSelectedNode)

  if (!edge) return null

  const source = nodes[edge.source]
  const target = nodes[edge.target]

  return (
    <aside className="details-panel" aria-label="Информация о связи">
      <header className="details-header">
        <div className="details-title">
          <span className="details-type">Связь</span>
          <h2>{EDGE_LABELS[edge.type]}</h2>
        </div>
        <button type="button" className="icon-button" onClick={() => setSelectedEdge(null)} aria-label="Закрыть">
          <X size={16} strokeWidth={1.5} />
        </button>
      </header>

      <div className="details-body">
        <div className="edge-endpoints">
          <button type="button" className="edge-endpoint" onClick={() => setSelectedNode(edge.source)}>
            {source?.label ?? edge.source}
          </button>
          <ArrowRight size={14} strokeWidth={1.5} />
          <button type="button" className="edge-endpoint" onClick={() => setSelectedNode(edge.target)}>
            {target?.label ?? edge.target}
          </button>
        </div>

        <div className="details-badges">
          <span className="state-badge">{CONFIDENCE_LABELS[edge.confidence]}</span>
          <span className="state-badge">{edge.type}</span>
        </div>

        <section className="details-section">
          <h3>Смысл связи</h3>
          <p className="details-description">{edge.explanation}</p>
        </section>

        <section className="details-section">
          <h3>Источники</h3>
          <ul className="evidence-list">
            {edge.evidence.map((evidence, index) => (
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
          </ul>
        </section>

        {Object.keys(edge.metadata).length > 0 ? (
          <section className="details-section">
            <h3>Метаданные</h3>
            <dl className="detail-list">
              {Object.entries(edge.metadata).map(([key, value]) => (
                <div key={key} className="detail-row">
                  <dt>{key}</dt>
                  <dd>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}

        <details className="raw-details">
          <summary>Исходные данные</summary>
          <pre>{JSON.stringify(edge, null, 2)}</pre>
        </details>
      </div>
    </aside>
  )
}
