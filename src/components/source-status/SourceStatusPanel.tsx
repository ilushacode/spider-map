import { ExternalLink } from 'lucide-react'
import { useGraphStore } from '../../graph/graph-store'
import type { SourceResult, SourceStatus } from '../../graph/types'
import { DATA_SOURCES } from '../../services/sources/registry'

const STATUS_LABELS: Record<SourceStatus, string> = {
  ok: 'работает',
  partial: 'частично',
  error: 'ошибка',
  unsupported: 'недоступно',
  'rate-limited': 'лимит',
  timeout: 'таймаут',
  cancelled: 'отменено',
}

function sourceStatus(results: SourceResult<unknown>[]): SourceStatus {
  if (results.length === 0) return 'unsupported'
  if (results.some((result) => result.status === 'ok')) return 'ok'
  if (results.some((result) => result.status === 'partial')) return 'partial'
  if (results.some((result) => result.status === 'rate-limited')) return 'rate-limited'
  if (results.some((result) => result.status === 'timeout')) return 'timeout'
  if (results.some((result) => result.status === 'cancelled')) return 'cancelled'
  return results[0].status
}

export default function SourceStatusPanel() {
  const investigation = useGraphStore((state) => state.investigation)
  const nodes = useGraphStore((state) => state.nodes)
  const edges = useGraphStore((state) => state.edges)

  const results = investigation ? Object.values(investigation.sourceResults) : []
  const nodeCount = Object.keys(nodes).length
  const edgeCount = Object.keys(edges).length

  return (
    <section className="panel-section">
      <header className="panel-section__header">
        <h2>Источники</h2>
        <span className="mono muted">{results.length}</span>
      </header>

      <div className="summary-grid">
        <div>
          <span className="summary-value">{nodeCount}</span>
          <span className="summary-label">узлов</span>
        </div>
        <div>
          <span className="summary-value">{edgeCount}</span>
          <span className="summary-label">связей</span>
        </div>
        <div>
          <span className="summary-value">{investigation?.counts.sourcesOk ?? 0}</span>
          <span className="summary-label">успешно</span>
        </div>
        <div>
          <span className="summary-value">{investigation?.counts.sourcesFailed ?? 0}</span>
          <span className="summary-label">ошибок</span>
        </div>
      </div>

      {(investigation?.counts.deferred ?? 0) > 0 ? (
        <p className="muted small">
          Отложено из-за лимитов: {investigation?.counts.deferred}. Раскройте узлы вручную, чтобы
          загрузить больше.
        </p>
      ) : null}

      <ul className="source-list">
        {DATA_SOURCES.map((source) => {
          const sourceResults = results.filter((result) => result.sourceId === source.id)
          const status = sourceStatus(sourceResults)
          return (
            <li key={source.id} className="source-row">
              <span className={`status-dot is-${status}`} aria-hidden="true" />
              <div className="source-row__body">
                <span className="source-row__name">{source.name}</span>
                <span className="source-row__meta">
                  {STATUS_LABELS[status]}
                  {sourceResults.length > 0 ? ` · ${sourceResults.length} запросов` : ''}
                </span>
              </div>
              <a
                className="icon-link"
                href={source.docsUrl}
                target="_blank"
                rel="noreferrer"
                title="Документация источника"
              >
                <ExternalLink size={13} strokeWidth={1.5} />
              </a>
            </li>
          )
        })}
      </ul>

      {investigation && investigation.errors.length > 0 ? (
        <div className="inline-error">{investigation.errors[0]}</div>
      ) : null}
    </section>
  )
}
