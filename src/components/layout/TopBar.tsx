import { useRef, useState } from 'react'
import { Download, FileJson, FileSpreadsheet, History, PanelLeft, Save, Upload } from 'lucide-react'
import type { InvestigationMode, NormalizedInput } from '../../graph/types'
import { exportCsv, exportJson, importJson, restoreGraph, saveGraph } from '../../features/export/export'
import SearchBar from '../search/SearchBar'
import SpiderMark from '../common/SpiderMark'

interface TopBarProps {
  mode: InvestigationMode
  onModeChange: (mode: InvestigationMode) => void
  onRun: (input: NormalizedInput, append: boolean) => void
  onStop: () => void
  running: boolean
  canAppend: boolean
  onToggleSidebar: () => void
}

export default function TopBar({
  mode,
  onModeChange,
  onRun,
  onStop,
  running,
  canAppend,
  onToggleSidebar,
}: TopBarProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const flash = (message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(null), 2200)
  }

  const handleImport = async (file: File | undefined) => {
    if (!file) return
    const error = await importJson(file)
    flash(error ?? 'Граф загружен')
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <header className="topbar">
      <div className="brand">
        <SpiderMark />
        <span className="brand__name">spider-map</span>
      </div>

      <div className="topbar__search">
        <SearchBar onRun={onRun} onStop={onStop} running={running} canAppend={canAppend} />
      </div>

      <div className="topbar__block topbar__mode">
        <span className="topbar__label">Режим</span>
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
      </div>

      <div className="topbar__block topbar__actions">
        <button
          type="button"
          className="icon-button"
          title="Сохранить граф"
          onClick={() => flash(saveGraph() ?? 'Граф сохранён')}
        >
          <Save size={16} strokeWidth={1.5} />
        </button>
        <button
          type="button"
          className="icon-button"
          title="Восстановить сохранённый граф"
          onClick={() => flash(restoreGraph() ?? 'Граф восстановлен')}
        >
          <History size={16} strokeWidth={1.5} />
        </button>
        <button type="button" className="icon-button" title="Экспорт JSON" onClick={exportJson}>
          <FileJson size={16} strokeWidth={1.5} />
        </button>
        <button type="button" className="icon-button" title="Экспорт CSV" onClick={exportCsv}>
          <FileSpreadsheet size={16} strokeWidth={1.5} />
        </button>
        <button
          type="button"
          className="icon-button"
          title="Импорт JSON"
          onClick={() => fileRef.current?.click()}
        >
          <Upload size={16} strokeWidth={1.5} />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(event) => void handleImport(event.target.files?.[0])}
        />
        <button type="button" className="icon-button" title="Панель источников" onClick={onToggleSidebar}>
          <PanelLeft size={16} strokeWidth={1.5} />
        </button>
      </div>

      {notice ? (
        <div className="toast" role="status">
          <Download size={14} strokeWidth={1.5} />
          {notice}
        </div>
      ) : null}
    </header>
  )
}
