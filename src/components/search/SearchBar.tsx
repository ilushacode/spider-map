import { useMemo, useState } from 'react'
import { Clock3, Play, Search, Square, X } from 'lucide-react'
import { normalizeInput } from '../../graph/normalize'
import type { InvestigationMode, NormalizedInput } from '../../graph/types'

const HISTORY_KEY = 'spider-map:history:v1'

function loadHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string').slice(0, 8) : []
  } catch {
    return []
  }
}

interface SearchBarProps {
  mode: InvestigationMode
  onModeChange: (mode: InvestigationMode) => void
  onRun: (input: NormalizedInput) => void
  onStop: () => void
  running: boolean
}

export default function SearchBar({ mode, onModeChange, onRun, onStop, running }: SearchBarProps) {
  const [value, setValue] = useState('')
  const [history, setHistory] = useState<string[]>(loadHistory)
  const [showHistory, setShowHistory] = useState(false)
  const normalized = useMemo(() => normalizeInput(value), [value])
  const hasError = value.trim().length > 0 && normalized.type === 'unknown'

  const submit = () => {
    if (running) return
    const result = normalizeInput(value)
    if (result.type === 'unknown') return
    setHistory((current) => {
      const next = [value.trim(), ...current.filter((item) => item !== value.trim())].slice(0, 8)
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
      } catch {
        // History is optional.
      }
      return next
    })
    setShowHistory(false)
    onRun(result)
  }

  return (
    <div className="search">
      <form
        className={`search__field${hasError ? ' has-error' : ''}`}
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <Search size={16} strokeWidth={1.5} aria-hidden="true" />
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onFocus={() => setShowHistory(history.length > 0)}
          onBlur={() => window.setTimeout(() => setShowHistory(false), 120)}
          placeholder="example.com, 1.1.1.1, AS13335, 104.16.0.0/13"
          aria-label="Объект исследования"
          spellCheck={false}
          autoComplete="off"
        />
        {value ? (
          <button
            type="button"
            className="search__clear"
            onClick={() => setValue('')}
            aria-label="Очистить"
          >
            <X size={14} strokeWidth={1.5} />
          </button>
        ) : null}
        {running ? (
          <button type="button" className="search__action is-stop" onClick={onStop} title="Остановить">
            <Square size={14} strokeWidth={1.5} />
          </button>
        ) : (
          <button type="submit" className="search__action" disabled={normalized.type === 'unknown'} title="Запустить">
            <Play size={14} strokeWidth={1.5} />
          </button>
        )}
      </form>

      {showHistory && history.length > 0 ? (
        <div className="search__history">
          {history.map((item) => (
            <button
              key={item}
              type="button"
              onMouseDown={() => setValue(item)}
              className="search__history-item"
            >
              <Clock3 size={13} strokeWidth={1.5} />
              {item}
            </button>
          ))}
        </div>
      ) : null}

      <div className="search__meta">
        <div className="mode-switch" role="group" aria-label="Режим исследования">
          {(
            [
              ['quick', 'Быстрый'],
              ['full', 'Полный'],
              ['explore', 'Исследование'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={mode === id ? 'is-active' : ''}
              onClick={() => onModeChange(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <span className={`search__hint${hasError ? ' is-error' : ''}`}>
          {hasError
            ? normalized.error
            : value.trim()
              ? `${normalized.type} · ${normalized.value || '—'}`
              : 'Тип определяется автоматически'}
        </span>
      </div>
    </div>
  )
}
