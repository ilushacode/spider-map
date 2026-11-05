import { useState } from 'react'
import { Database, Info, Radio, SlidersHorizontal } from 'lucide-react'
import { useGraphStore } from '../../graph/graph-store'
import { NODE_VISUALS } from '../graph/node-visuals'
import FilterPanel from '../filters/FilterPanel'
import SourceStatusPanel from '../source-status/SourceStatusPanel'
import DataSections from './DataSections'

type Tab = 'overview' | 'data' | 'sources' | 'filters'

const STATUS_TEXT = {
  idle: 'ожидание',
  resolving: 'определение',
  collecting: 'сбор данных',
  partial: 'частично',
  complete: 'завершено',
  cancelled: 'отменено',
  error: 'ошибка',
} as const

function OverviewPanel() {
  const investigation = useGraphStore((state) => state.investigation)
  const nodes = useGraphStore((state) => state.nodes)

  if (!investigation) {
    return (
      <section className="panel-section">
        <header className="panel-section__header">
          <h2>Обзор</h2>
        </header>
        <p className="muted small">
          Введите домен, IP, префикс или ASN. Приложение запросит публичные источники и построит граф
          подтверждённых связей.
        </p>
        <div className="legend">
          {Object.entries(NODE_VISUALS)
            .filter(([type]) =>
              ['domain', 'ip', 'prefix', 'asn', 'certificate', 'organization'].includes(type),
            )
            .map(([type, visual]) => (
              <span key={type} className="legend-item">
                <span className="legend-dot" style={{ background: visual.color }} />
                {visual.label}
              </span>
            ))}
        </div>
      </section>
    )
  }

  const typeCounts = new Map<string, number>()
  for (const node of Object.values(nodes)) {
    typeCounts.set(node.type, (typeCounts.get(node.type) ?? 0) + 1)
  }

  return (
    <>
      <section className="panel-section">
        <header className="panel-section__header">
          <h2>Исследование</h2>
          <span className={`status-pill is-${investigation.status}`}>
            {STATUS_TEXT[investigation.status]}
          </span>
        </header>
        <dl className="detail-list">
          <div className="detail-row">
            <dt>Объект</dt>
            <dd>{investigation.normalized || investigation.input}</dd>
          </div>
          <div className="detail-row">
            <dt>Тип</dt>
            <dd>{investigation.inputType}</dd>
          </div>
          <div className="detail-row">
            <dt>Режим</dt>
            <dd>{investigation.mode}</dd>
          </div>
          <div className="detail-row">
            <dt>Начато</dt>
            <dd>{new Date(investigation.startedAt).toLocaleTimeString('ru-RU')}</dd>
          </div>
        </dl>
      </section>

      <section className="panel-section">
        <header className="panel-section__header">
          <h2>Состав графа</h2>
        </header>
        <ul className="type-counts">
          {[...typeCounts.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([type, count]) => {
              const visual = NODE_VISUALS[type as keyof typeof NODE_VISUALS]
              return (
                <li key={type}>
                  <span className="legend-dot" style={{ background: visual.color }} />
                  <span>{visual.label}</span>
                  <span className="mono muted">{count}</span>
                </li>
              )
            })}
        </ul>
      </section>
    </>
  )
}

export default function Sidebar({ open }: { open: boolean }) {
  const [tab, setTab] = useState<Tab>('overview')

  return (
    <aside className={`sidebar${open ? '' : ' is-collapsed'}`} aria-label="Боковая панель">
      <nav className="sidebar-tabs" aria-label="Разделы панели">
        <button type="button" className={tab === 'overview' ? 'is-active' : ''} onClick={() => setTab('overview')}>
          <Info size={15} strokeWidth={1.5} />
          Обзор
        </button>
        <button type="button" className={tab === 'data' ? 'is-active' : ''} onClick={() => setTab('data')}>
          <Database size={15} strokeWidth={1.5} />
          Данные
        </button>
        <button type="button" className={tab === 'sources' ? 'is-active' : ''} onClick={() => setTab('sources')}>
          <Radio size={15} strokeWidth={1.5} />
          Источники
        </button>
        <button type="button" className={tab === 'filters' ? 'is-active' : ''} onClick={() => setTab('filters')}>
          <SlidersHorizontal size={15} strokeWidth={1.5} />
          Фильтры
        </button>
      </nav>

      <div className="sidebar-content">
        {tab === 'overview' ? <OverviewPanel /> : null}
        {tab === 'data' ? <DataSections /> : null}
        {tab === 'sources' ? <SourceStatusPanel /> : null}
        {tab === 'filters' ? <FilterPanel /> : null}
      </div>
    </aside>
  )
}
