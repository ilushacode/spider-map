import type { SourceId } from '../../graph/types'
import { responseCache } from '../cache/cache'
import { KeyedSemaphore, Semaphore } from '../rate-limit/limiter'
import { isAllowedUrl } from './allowlist'

export interface HttpRequestOptions {
  signal?: AbortSignal
  timeoutMs?: number
  headers?: Record<string, string>
  cacheKey?: string
  ttlMs?: number
  sourceId?: SourceId
  maxBytes?: number
  retries?: number
}

export interface HttpResponse<T> {
  ok: boolean
  status: number
  data?: T
  error?: string
  url: string
  durationMs: number
  fromCache: boolean
}

const DEFAULT_TIMEOUT_MS = 12_000
const DEFAULT_MAX_BYTES = 2_000_000
const DEFAULT_RETRIES = 2
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504])

const globalSemaphore = new Semaphore(8)
const hostSemaphore = new KeyedSemaphore(2)
const inFlight = new Map<string, Promise<HttpResponse<unknown>>>()

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

function backoffDelay(attempt: number): number {
  const base = 400 * 2 ** attempt
  return base + Math.floor(Math.random() * 250)
}

async function execute<T>(url: string, options: HttpRequestOptions): Promise<HttpResponse<T>> {
  const startedAt = performance.now()
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES
  const retries = options.retries ?? DEFAULT_RETRIES
  const host = new URL(url).hostname

  const releaseGlobal = await globalSemaphore.acquire()
  const releaseHost = await hostSemaphore.acquire(host)
  try {
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      if (options.signal?.aborted) {
        return {
          ok: false,
          status: 0,
          error: 'Запрос отменён',
          url,
          durationMs: performance.now() - startedAt,
          fromCache: false,
        }
      }

      const controller = new AbortController()
      let timedOut = false
      const timer = setTimeout(() => {
        timedOut = true
        controller.abort()
      }, timeoutMs)
      const onAbort = () => controller.abort()
      options.signal?.addEventListener('abort', onAbort, { once: true })

      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: options.headers,
          signal: controller.signal,
          redirect: 'follow',
        })

        if (!response.ok) {
          if (RETRYABLE_STATUS.has(response.status) && attempt < retries) {
            await sleep(backoffDelay(attempt), options.signal)
            continue
          }
          return {
            ok: false,
            status: response.status,
            error: `HTTP ${response.status}`,
            url,
            durationMs: performance.now() - startedAt,
            fromCache: false,
          }
        }

        const contentLength = Number(response.headers.get('content-length') ?? '0')
        if (contentLength > maxBytes) {
          return {
            ok: false,
            status: response.status,
            error: 'Ответ превышает допустимый размер',
            url,
            durationMs: performance.now() - startedAt,
            fromCache: false,
          }
        }

        const text = await response.text()
        if (text.length > maxBytes) {
          return {
            ok: false,
            status: response.status,
            error: 'Ответ превышает допустимый размер',
            url,
            durationMs: performance.now() - startedAt,
            fromCache: false,
          }
        }

        let data: T
        try {
          data = JSON.parse(text) as T
        } catch {
          return {
            ok: false,
            status: response.status,
            error: 'Некорректный JSON в ответе',
            url,
            durationMs: performance.now() - startedAt,
            fromCache: false,
          }
        }

        if (options.cacheKey && options.ttlMs && options.sourceId) {
          responseCache.set(options.cacheKey, data, options.ttlMs, options.sourceId)
        }

        return {
          ok: true,
          status: response.status,
          data,
          url,
          durationMs: performance.now() - startedAt,
          fromCache: false,
        }
      } catch (error) {
        if (options.signal?.aborted) {
          return {
            ok: false,
            status: 0,
            error: 'Запрос отменён',
            url,
            durationMs: performance.now() - startedAt,
            fromCache: false,
          }
        }
        if (timedOut) {
          return {
            ok: false,
            status: 0,
            error: 'Таймаут запроса',
            url,
            durationMs: performance.now() - startedAt,
            fromCache: false,
          }
        }
        if (attempt < retries) {
          await sleep(backoffDelay(attempt), options.signal)
          continue
        }
        return {
          ok: false,
          status: 0,
          error: error instanceof Error ? error.message : 'Сетевая ошибка',
          url,
          durationMs: performance.now() - startedAt,
          fromCache: false,
        }
      } finally {
        clearTimeout(timer)
        options.signal?.removeEventListener('abort', onAbort)
      }
    }

    return {
      ok: false,
      status: 0,
      error: 'Не удалось выполнить запрос',
      url,
      durationMs: performance.now() - startedAt,
      fromCache: false,
    }
  } finally {
    releaseHost()
    releaseGlobal()
  }
}

export async function httpRequest<T>(
  url: string,
  options: HttpRequestOptions = {},
): Promise<HttpResponse<T>> {
  if (!isAllowedUrl(url)) {
    return {
      ok: false,
      status: 0,
      error: 'Источник не входит в allowlist',
      url,
      durationMs: 0,
      fromCache: false,
    }
  }

  const cacheKey = options.cacheKey ?? url
  if (options.ttlMs) {
    const cached = responseCache.get<T>(cacheKey)
    if (cached !== undefined) {
      return {
        ok: true,
        status: 200,
        data: cached,
        url,
        durationMs: 0,
        fromCache: true,
      }
    }
  }

  const existing = inFlight.get(cacheKey)
  if (existing) {
    return existing as Promise<HttpResponse<T>>
  }

  const promise = execute<T>(url, { ...options, cacheKey })
  inFlight.set(cacheKey, promise as Promise<HttpResponse<unknown>>)
  try {
    return await promise
  } finally {
    inFlight.delete(cacheKey)
  }
}
