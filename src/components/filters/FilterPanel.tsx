import { Search } from 'lucide-react'
import { useGraphStore } from '../../graph/graph-store'
import {
  CONFIDENCE_LEVELS,
  EDGE_TYPES,
  NODE_TYPES,
  type Confidence,
} from '../../graph/types'
import { EDGE_LABELS, NODE_VISUALS } from '../graph/node-visuals'

export default function FilterPanel() {
  const filters = useGraphStore((state) => state.filters)
  const setFilters = useGraphStore((state) => state.setFilters)
  const toggleNodeType = useGraphStore((state) => state.toggleNodeType)
  const toggleEdgeType = useGraphStore((state) => state.toggleEdgeType)
  const nodes = useGraphStore((state) => state.nodes)

  const presentNodeTypes = NODE_TYPES.filter((type) =>
    Object.values(nodes).some((node) => node.type === type),
  )
  const presentEdgeTypes = EDGE_TYPES

  return (
    <section className="panel-section">
      <header className="panel-section__header">
        <h2>Фильтры</h2>
      </header>

      <label className="filter-search">
        <Search size={14} strokeWidth={1.5} aria-hidden="true" />
        <input
          value={filters.search}
          onChange={(event) => setFilters({ search: event.target.value })}
          placeholder="Поиск узла"
          aria-label="Поиск узла"
        />
      </label>

      <label className="filter-select">
        <span>Минимальная уверенность</span>
        <select
          value={filters.minConfidence}
          onChange={(event) => setFilters({ minConfidence: event.target.value as Confidence | 'all' })}
        >
          <option value="all">Все</option>
          {CONFIDENCE_LEVELS.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
      </label>

      <div className="filter-group">
        <span className="filter-group__title">Типы узлов</span>
        <div className="chip-grid">
          {presentNodeTypes.map((type) => {
            const visual = NODE_VISUALS[type]
            const active = !filters.hiddenNodeTypes.includes(type)
            return (
              <button
                key={type}
                type="button"
                className={`chip${active ? ' is-active' : ''}`}
                onClick={() => toggleNodeType(type)}
                style={{ '--chip-color': visual.color } as React.CSSProperties}
              >
                {visual.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="filter-group">
        <span className="filter-group__title">Типы связей</span>
        <div className="chip-grid">
          {presentEdgeTypes.map((type) => {
            const active = !filters.hiddenEdgeTypes.includes(type)
            return (
              <button
                key={type}
                type="button"
                className={`chip${active ? ' is-active' : ''}`}
                onClick={() => toggleEdgeType(type)}
              >
                {EDGE_LABELS[type]}
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
