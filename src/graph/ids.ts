import type { EdgeType, NodeType } from './types'

export function nodeId(type: NodeType, identifier: string): string {
  return `${type}:${identifier.toLowerCase()}`
}

export function edgeId(type: EdgeType, source: string, target: string): string {
  return `${type}:${source}->${target}`
}
