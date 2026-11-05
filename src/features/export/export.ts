import { useGraphStore } from '../../graph/graph-store'
import type { GraphSnapshot } from '../../graph/types'
import { graphSnapshotSchema } from '../../schemas/graph'
import { DATA_SOURCES } from '../../services/sources/registry'

const SAVE_KEY = 'spider-map:graph:v1'
const MAX_IMPORT_BYTES = 5_000_000

export function buildSnapshot(): GraphSnapshot {
  const state = useGraphStore.getState()
  const investigation = state.investigation
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    input: investigation?.input ?? '',
    normalized: investigation?.normalized ?? '',
    inputType: investigation?.inputType ?? 'unknown',
    nodes: Object.values(state.nodes),
    edges: Object.values(state.edges),
    sources: DATA_SOURCES,
    investigation,
  }
}

function download(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function exportJson(): void {
  const snapshot = buildSnapshot()
  download(`spider-map-${Date.now()}.json`, JSON.stringify(snapshot, null, 2), 'application/json')
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value)
  return `"${text.replace(/"/g, '""')}"`
}

export function exportCsv(): void {
  const state = useGraphStore.getState()
  const nodeHeader = ['id', 'type', 'label', 'identifier', 'loadState', 'completeness', 'sources']
  const nodeRows = Object.values(state.nodes).map((node) =>
    [
      node.id,
      node.type,
      node.label,
      node.identifier,
      node.loadState,
      node.completeness,
      node.sources.map((source) => source.sourceId).join('|'),
    ]
      .map(csvCell)
      .join(','),
  )
  const edgeHeader = ['id', 'type', 'source', 'target', 'label', 'confidence', 'explanation']
  const edgeRows = Object.values(state.edges).map((edge) =>
    [edge.id, edge.type, edge.source, edge.target, edge.label, edge.confidence, edge.explanation]
      .map(csvCell)
      .join(','),
  )
  download(`spider-map-nodes-${Date.now()}.csv`, [nodeHeader.join(','), ...nodeRows].join('\n'), 'text/csv')
  download(`spider-map-edges-${Date.now()}.csv`, [edgeHeader.join(','), ...edgeRows].join('\n'), 'text/csv')
}

export async function importJson(file: File): Promise<string | null> {
  if (file.size > MAX_IMPORT_BYTES) return 'Файл слишком большой (максимум 5 МБ)'
  try {
    const text = await file.text()
    const parsed = JSON.parse(text) as unknown
    const validation = graphSnapshotSchema.safeParse(parsed)
    if (!validation.success) return 'Файл не соответствует формату spider-map'
    useGraphStore.getState().loadSnapshot(validation.data as unknown as GraphSnapshot)
    return null
  } catch {
    return 'Не удалось прочитать файл'
  }
}

export function saveGraph(): string | null {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(buildSnapshot()))
    return null
  } catch {
    return 'Не удалось сохранить граф'
  }
}

export function restoreGraph(): string | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return 'Сохранённый граф не найден'
    const validation = graphSnapshotSchema.safeParse(JSON.parse(raw) as unknown)
    if (!validation.success) return 'Сохранённый граф повреждён'
    useGraphStore.getState().loadSnapshot(validation.data as unknown as GraphSnapshot)
    return null
  } catch {
    return 'Не удалось восстановить граф'
  }
}
