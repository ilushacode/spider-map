import { useRef, useState } from 'react'
import { Download, FileJson, FileSpreadsheet, History, PanelLeft, Save, Upload } from 'lucide-react'
import type { InvestigationMode, NormalizedInput } from '../../graph/types'
import { exportCsv, exportJson, importJson, restoreGraph, saveGraph } from '../../features/export/export'
import SearchBar from '../search/SearchBar'
import SpiderMark from '../common/SpiderMark'

interface TopBarProps {
  mode: InvestigationMode
  onModeChange: (mode: InvestigationMode) => void
  onRun: (input: NormalizedInput) => void
  onStop: () => void
  running: boolean
  onToggleSidebar: () => void
}

export default function TopBar({
  mode,
  onModeChange,
  onRun,
  onStop,
  running,
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

      <SearchBar
        mode={mode}
        onModeChange={onModeChange}
        onRun={onRun}
        onStop={onStop}
        running={running}
      />

      <div className="topbar__actions">
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
