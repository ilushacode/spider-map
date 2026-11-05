import type { Confidence, Evidence, SourceId, SourceResult } from '../../graph/types'
import { getDataSource } from '../../services/sources/registry'

export function evidenceFrom(
  result: SourceResult<unknown>,
  confidence: Confidence = 'observed',
  note?: string,
): Evidence {
  return {
    sourceId: result.sourceId,
    sourceName: getDataSource(result.sourceId)?.name ?? result.sourceId,
    url: result.url,
    retrievedAt: result.retrievedAt,
    confidence,
    note,
  }
}

export function evidenceFromSource(
  sourceId: SourceId,
  url: string,
  confidence: Confidence = 'observed',
  note?: string,
): Evidence {
  return {
    sourceId,
    sourceName: getDataSource(sourceId)?.name ?? sourceId,
    url,
    retrievedAt: new Date().toISOString(),
    confidence,
    note,
  }
}
