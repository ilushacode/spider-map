import { useCallback, useRef, useState } from 'react'
import './styles/app.css'
import GraphView from './components/graph/GraphView'
import NodeDetailsPanel from './components/node-details/NodeDetailsPanel'
import Sidebar from './components/layout/Sidebar'
import TopBar from './components/layout/TopBar'
import { runInvestigation } from './features/investigation/orchestrator'
import { useGraphStore } from './graph/graph-store'
import type { InvestigationMode, NormalizedInput } from './graph/types'

function StatusBar() {
  const investigation = useGraphStore((state) => state.investigation)
  const nodes = useGraphStore((state) => state.nodes)
  const edges = useGraphStore((state) => state.edges)
  const selectedNodeId = useGraphStore((state) => state.selectedNodeId)

  const selected = selectedNodeId ? nodes[selectedNodeId] : undefined

  return (
    <footer className="statusbar">
      <span>
        {investigation
          ? `${investigation.status} · ${Object.keys(nodes).length} узлов · ${Object.keys(edges).length} связей`
          : 'Готов к исследованию'}
      </span>
      <span className="statusbar__right">
        {selected ? `выбран: ${selected.label}` : 'только публичные источники'}
      </span>
    </footer>
  )
}

function EmptyState({ running }: { running: boolean }) {
  const hasInvestigation = useGraphStore((state) => Boolean(state.investigation))
  const nodeCount = useGraphStore((state) => Object.keys(state.nodes).length)

  if (hasInvestigation && nodeCount > 0) return null

  return (
    <div className="empty-state">
      <div className="empty-state__inner">
        <span className="empty-state__eyebrow">Инфраструктурный граф</span>
        <h1>{running ? 'Собираю данные из публичных источников' : 'Введите объект исследования'}</h1>
        <p>
          Домен, IP-адрес, префикс или ASN. Граф соберётся из DNS, RDAP, RIPEstat и Certificate
          Transparency. Каждая связь сохраняет источник и уверенность.
        </p>
        <ul className="empty-examples">
          <li><code>example.com</code></li>
          <li><code>1.1.1.1</code></li>
          <li><code>AS13335</code></li>
          <li><code>104.16.0.0/13</code></li>
          <li><code>2606:4700:4700::1111</code></li>
        </ul>
        {running ? <div className="scan-line" aria-hidden="true" /> : null}
      </div>
    </div>
  )
}

export default function App() {
  const [mode, setMode] = useState<InvestigationMode>('full')
  const [running, setRunning] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const controllerRef = useRef<AbortController | null>(null)

  const onRun = useCallback(
    async (input: NormalizedInput) => {
      controllerRef.current?.abort()
      const controller = new AbortController()
      controllerRef.current = controller
      setRunning(true)
      const budget = window.setTimeout(() => controller.abort(), 75_000)
      try {
        await runInvestigation(input, mode, controller.signal)
      } finally {
        window.clearTimeout(budget)
        if (controllerRef.current === controller) {
          setRunning(false)
        }
      }
    },
    [mode],
  )

  const onStop = useCallback(() => {
    controllerRef.current?.abort()
    controllerRef.current = null
    setRunning(false)
  }, [])

  return (
    <div className="app">
      <TopBar
        mode={mode}
        onModeChange={setMode}
        onRun={(input) => void onRun(input)}
        onStop={onStop}
        running={running}
        onToggleSidebar={() => setSidebarOpen((open) => !open)}
      />

      <div className={`workspace${sidebarOpen ? '' : ' sidebar-closed'}`}>
        <Sidebar open={sidebarOpen} />
        <main className="graph-area">
          <GraphView />
          <EmptyState running={running} />
          <NodeDetailsPanel />
        </main>
      </div>

      <StatusBar />
    </div>
  )
}
