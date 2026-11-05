import type { SourceId } from '../../graph/types'

export interface CacheEntry<T> {
  key: string
  value: T
  storedAt: number
  expiresAt: number
  sourceId: SourceId
  schemaVersion: number
}

const SCHEMA_VERSION = 1
const STORAGE_KEY = 'spider-map:cache:v1'
const MAX_ENTRIES = 300

export class ResponseCache {
  private readonly memory = new Map<string, CacheEntry<unknown>>()

  constructor() {
    this.load()
  }

  get<T>(key: string): T | undefined {
    const entry = this.memory.get(key)
    if (!entry) return undefined
    if (entry.expiresAt <= Date.now()) {
      this.memory.delete(key)
      this.persist()
      return undefined
    }
    return entry.value as T
  }

  set<T>(key: string, value: T, ttlMs: number, sourceId: SourceId): void {
    const now = Date.now()
    this.memory.set(key, {
      key,
      value,
      storedAt: now,
      expiresAt: now + ttlMs,
      sourceId,
      schemaVersion: SCHEMA_VERSION,
    })
    this.trim()
    this.persist()
  }

  delete(key: string): void {
    this.memory.delete(key)
    this.persist()
  }

  clear(): void {
    this.memory.clear()
    this.persist()
  }

  private trim(): void {
    if (this.memory.size <= MAX_ENTRIES) return
    const entries = [...this.memory.values()].sort((a, b) => a.storedAt - b.storedAt)
    const removeCount = this.memory.size - MAX_ENTRIES
    for (let i = 0; i < removeCount; i += 1) {
      this.memory.delete(entries[i].key)
    }
  }

  private load(): void {
    try {
      const raw = globalThis.localStorage?.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as CacheEntry<unknown>[]
      if (!Array.isArray(parsed)) return
      const now = Date.now()
      for (const entry of parsed) {
        if (
          entry &&
          typeof entry.key === 'string' &&
          entry.schemaVersion === SCHEMA_VERSION &&
          entry.expiresAt > now
        ) {
          this.memory.set(entry.key, entry)
        }
      }
    } catch {
      this.memory.clear()
    }
  }

  private persist(): void {
    try {
      const entries = [...this.memory.values()]
      globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(entries))
    } catch {
      // Storage can be unavailable or full; the in-memory cache still works.
    }
  }
}

export const responseCache = new ResponseCache()
