import { createEdge, createNode } from '../../graph/factory'
import { useGraphStore } from '../../graph/graph-store'
import { isPrivateOrSpecialIp } from '../../graph/normalize'
import type {
  InputType,
  InternetNode,
  Investigation,
  InvestigationMode,
  NormalizedInput,
  NodeType,
  SourceResult,
} from '../../graph/types'
import { searchCertificates } from '../../services/sources/certificate-transparency'
import { queryCloudflareDns } from '../../services/sources/cloudflare-dns'
import type { DnsAnswer, DnsRecordType } from '../../services/sources/dns'
import { queryGoogleDns } from '../../services/sources/google-dns'
import { lookupAsn, lookupDomain, lookupIp } from '../../services/sources/rdap'
import {
  fetchAbuseContact,
  fetchAnnouncedPrefixes,
  fetchAsOverview,
  fetchLookingGlass,
  fetchNetworkInfo,
  fetchPrefixCount,
  fetchPrefixOverview,
  fetchRoutingHistory,
  fetchRpkiValidation,
} from '../../services/sources/ripestat'
import { evidenceFrom, evidenceFromSource } from './evidence'

const MAX_NODES = 150
const MAX_EDGES = 300
const MAX_IPS = 20
const MAX_PREFIXES = 25
const MAX_CERTIFICATES = 50
const MAX_NAMES = 100

interface RunContext {
  signal: AbortSignal
  mode: InvestigationMode
  seenAsns: Set<string>
  seenIps: Set<string>
  seenPrefixes: Set<string>
  deferred: number
}

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `inv-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function sourceKey(sourceId: string, endpoint: string, resource: string): string {
  return `${sourceId}:${endpoint}:${resource}`
}

function addNodeSafe(node: InternetNode): boolean {
  const store = useGraphStore.getState()
  if (!store.nodes[node.id] && Object.keys(store.nodes).length >= MAX_NODES) {
    return false
  }
  store.addNode(node)
  return true
}

function addEdgeSafe(edge: ReturnType<typeof createEdge>): boolean {
  const store = useGraphStore.getState()
  if (!store.edges[edge.id] && Object.keys(store.edges).length >= MAX_EDGES) {
    return false
  }
  store.addEdge(edge)
  return true
}

function record(context: RunContext, key: string, result: SourceResult<unknown>): void {
  void context
  useGraphStore.getState().setSourceResult(key, result)
}

function rootNode(input: NormalizedInput): InternetNode {
  const type: NodeType =
    input.type === 'cidr'
      ? 'prefix'
      : input.type === 'asn'
        ? 'asn'
        : input.type === 'ipv4' || input.type === 'ipv6'
          ? 'ip'
          : 'domain'
  return createNode({
    type,
    identifier: input.value,
    label: input.value,
    loadState: 'loading',
    completeness: 'partial',
    metadata: { inputType: input.type, userProvided: true },
  })
}

function markRoot(id: string, state: InternetNode['loadState'], error?: string): void {
  useGraphStore.getState().setNodeLoadState(id, state, error)
}

function addDnsRecords(
  result: SourceResult<DnsAnswer>,
  owner: InternetNode,
  zone?: string,
): string[] {
  if (!result.data || result.status !== 'ok') return []
  const evidence = evidenceFrom(result)
  const ips: string[] = []

  for (const record of result.data.records) {
    if (record.type === 'A' || record.type === 'AAAA') {
      const ip = createNode({
        type: 'ip',
        identifier: record.data,
        evidence,
        metadata: { ttl: record.ttl, resolver: result.data.resolver },
      })
      if (addNodeSafe(ip)) {
        addEdgeSafe(
          createEdge({
            type: 'RESOLVES_TO',
            source: owner.id,
            target: ip.id,
            evidence,
            metadata: { recordType: record.type, ttl: record.ttl },
          }),
        )
        ips.push(record.data)
      }
      continue
    }

    if (record.type === 'CNAME') {
      const target = record.data.replace(/\.$/, '').toLowerCase()
      const node = createNode({ type: 'domain', identifier: target, evidence })
      if (addNodeSafe(node)) {
        addEdgeSafe(createEdge({ type: 'CNAME_TO', source: owner.id, target: node.id, evidence }))
      }
      continue
    }

    if (record.type === 'MX') {
      const host = record.data.split(' ').pop()?.replace(/\.$/, '').toLowerCase()
      if (!host) continue
      const node = createNode({
        type: 'mail-server',
        identifier: host,
        evidence,
        metadata: { preference: record.data.split(' ')[0] },
      })
      if (addNodeSafe(node)) {
        addEdgeSafe(createEdge({ type: 'HAS_MX', source: owner.id, target: node.id, evidence }))
      }
      continue
    }

    if (record.type === 'NS') {
      const host = record.data.replace(/\.$/, '').toLowerCase()
      const node = createNode({ type: 'nameserver', identifier: host, evidence })
      if (addNodeSafe(node)) {
        addEdgeSafe(createEdge({ type: 'HAS_NS', source: owner.id, target: node.id, evidence }))
      }
      continue
    }

    const identifier = `${owner.identifier}:${record.type}:${record.data}`
    const node = createNode({
      type: 'dns-record',
      identifier,
      label: `${record.type} ${record.data}`,
      evidence,
      metadata: { recordType: record.type, value: record.data, ttl: record.ttl, zone },
    })
    if (addNodeSafe(node)) {
      addEdgeSafe(
        createEdge({
          type: 'HAS_DNS_RECORD',
          source: owner.id,
          target: node.id,
          evidence,
          metadata: { recordType: record.type },
        }),
      )
    }
  }

  return ips
}

async function processAsn(context: RunContext, asn: string): Promise<void> {
  if (context.signal.aborted) return
  if (context.seenAsns.has(asn)) return
  if (context.seenAsns.size >= 20) return
  context.seenAsns.add(asn)

  const asnId = `asn:${asn.toLowerCase()}`
  const existing = useGraphStore.getState().nodes[asnId]
  if (!existing) {
    addNodeSafe(createNode({ type: 'asn', identifier: asn, loadState: 'loading' }))
  }

  const overview = await fetchAsOverview(asn, context.signal)
  record(context, sourceKey('ripestat', 'as-overview', asn), overview)
  if (overview.data) {
    const evidence = evidenceFrom(overview, 'authoritative')
    const node = createNode({
      type: 'asn',
      identifier: asn,
      label: overview.data.holder ? `${asn} · ${overview.data.holder}` : asn,
      description: overview.data.holder,
      evidence,
      metadata: {
        holder: overview.data.holder,
        announced: overview.data.announced,
        block: overview.data.block,
      },
      loadState: 'partial',
      completeness: 'partial',
    })
    addNodeSafe(node)
    if (overview.data.holder) {
      const org = createNode({
        type: 'organization',
        identifier: overview.data.holder,
        evidence,
        metadata: { role: 'AS holder', asn },
      })
      if (addNodeSafe(org)) {
        addEdgeSafe(
          createEdge({
            type: 'HAS_REGISTRATION',
            source: asnId,
            target: org.id,
            evidence,
            label: 'зарегистрирован на',
            explanation: 'Зарегистрированный держатель ASN по данным RIPEstat.',
          }),
        )
      }
    }
  }

  if (context.mode === 'quick') {
    markRoot(asnId, overview.status === 'ok' ? 'explored' : 'partial')
    return
  }

  const rdap = await lookupAsn(asn, context.signal)
  record(context, sourceKey('rdap', 'autnum', asn), rdap)
  if (rdap.data) {
    addRdapEntities(asnId, rdap)
  }

  const abuse = await fetchAbuseContact(asn, context.signal)
  record(context, sourceKey('ripestat', 'abuse-contact-finder', asn), abuse)
  if (abuse.data) {
    for (const contact of abuse.data.contacts) {
      const org = createNode({ type: 'organization', identifier: contact, evidence: evidenceFrom(abuse) })
      if (addNodeSafe(org)) {
        addEdgeSafe(
          createEdge({
            type: 'HAS_ABUSE_CONTACT',
            source: asnId,
            target: org.id,
            evidence: evidenceFrom(abuse),
            label: 'abuse-контакт',
          }),
        )
      }
    }
  }

  const prefixes = await fetchAnnouncedPrefixes(asn, context.signal)
  record(context, sourceKey('ripestat', 'announced-prefixes', asn), prefixes)
  if (prefixes.data) {
    const limited = prefixes.data.prefixes.slice(0, MAX_PREFIXES)
    for (const prefix of limited) {
      if (context.seenPrefixes.has(prefix)) continue
      context.seenPrefixes.add(prefix)
      const node = createNode({ type: 'prefix', identifier: prefix, evidence: evidenceFrom(prefixes) })
      if (addNodeSafe(node)) {
        addEdgeSafe(
          createEdge({
            type: 'ANNOUNCED_BY',
            source: node.id,
            target: asnId,
            evidence: evidenceFrom(prefixes),
          }),
        )
      }
    }
  }

  const count = await fetchPrefixCount(asn, context.signal)
  record(context, sourceKey('ripestat', 'prefix-count', asn), count)
  if (count.data) {
    const node = useGraphStore.getState().nodes[asnId]
    if (node) {
      useGraphStore.getState().addNode({
        ...node,
        metadata: { ...node.metadata, prefixCount: count.data.series.slice(-1)[0] ?? null },
      })
    }
  }

  await processRoutingHistory(context, asn)
  markRoot(asnId, 'explored')
}

async function processRoutingHistory(context: RunContext, resource: string): Promise<void> {
  const history = await fetchRoutingHistory(resource, context.signal)
  record(context, sourceKey('ripestat', 'routing-history', resource), history)
  if (!history.data) return
  const evidence = evidenceFrom(history)
  const sourceId = `prefix:${resource.toLowerCase()}`
  for (const entry of history.data.origins.slice(0, 10)) {
    if (!entry.origin) continue
    const asn = `AS${entry.origin}`
    const asnId = `asn:${asn.toLowerCase()}`
    if (!useGraphStore.getState().nodes[asnId]) {
      addNodeSafe(createNode({ type: 'asn', identifier: asn, evidence }))
    }
    for (const prefix of entry.prefixes.slice(0, 10)) {
      const prefixNode = createNode({ type: 'prefix', identifier: prefix, evidence })
      if (addNodeSafe(prefixNode)) {
        addEdgeSafe(createEdge({ type: 'OBSERVED_IN_ROUTE', source: prefixNode.id, target: asnId, evidence }))
      }
    }
    if (useGraphStore.getState().nodes[sourceId]) {
      addEdgeSafe(createEdge({ type: 'OBSERVED_IN_ROUTE', source: sourceId, target: asnId, evidence }))
    }
  }
}

function addRdapEntities(ownerId: string, result: SourceResult<{ entities: Array<{ handle?: string; roles: string[]; name?: string; organization?: string; email?: string; url?: string }> }>): void {
  if (!result.data) return
  const evidence = evidenceFrom(result, 'authoritative')
  for (const entity of result.data.entities) {
    const roles = entity.roles ?? []
    const identifier = entity.organization ?? entity.name ?? entity.handle
    if (!identifier) continue
    const type: NodeType = roles.includes('registrar') ? 'registrar' : 'organization'
    const node = createNode({
      type,
      identifier,
      label: identifier,
      evidence,
      metadata: {
        roles,
        handle: entity.handle,
        email: entity.email,
        url: entity.url,
      },
    })
    if (addNodeSafe(node)) {
      addEdgeSafe(
        createEdge({
          type: type === 'registrar' ? 'REGISTERED_BY' : 'HAS_REGISTRATION',
          source: ownerId,
          target: node.id,
          evidence,
        }),
      )
    }
  }
}

async function processIp(context: RunContext, ip: string): Promise<void> {
  if (context.signal.aborted) return
  if (context.seenIps.has(ip)) return
  if (context.seenIps.size >= MAX_IPS) return
  context.seenIps.add(ip)

  const ipId = `ip:${ip.toLowerCase()}`
  if (!useGraphStore.getState().nodes[ipId]) {
    addNodeSafe(createNode({ type: 'ip', identifier: ip, loadState: 'loading' }))
  }
  if (isPrivateOrSpecialIp(ip)) {
    markRoot(ipId, 'source-limited', 'Приватный или специальный IP-адрес')
    return
  }

  const network = await fetchNetworkInfo(ip, context.signal)
  record(context, sourceKey('ripestat', 'network-info', ip), network)
  const evidence = network.data ? evidenceFrom(network) : evidenceFromSource('ripestat', network.url)

  if (network.data?.prefix) {
    const prefixId = `prefix:${network.data.prefix.toLowerCase()}`
    const prefix = createNode({
      type: 'prefix',
      identifier: network.data.prefix,
      evidence,
      metadata: { containsIp: ip },
    })
    if (addNodeSafe(prefix)) {
      addEdgeSafe(createEdge({ type: 'WITHIN_PREFIX', source: ipId, target: prefixId, evidence }))
    }
    context.seenPrefixes.add(network.data.prefix)

    for (const asnNumber of network.data.asns) {
      const asn = `AS${asnNumber}`
      const asnNode = createNode({ type: 'asn', identifier: asn, evidence })
      if (addNodeSafe(asnNode)) {
        addEdgeSafe(createEdge({ type: 'ANNOUNCED_BY', source: prefixId, target: asnNode.id, evidence }))
      }
    }
  }

  if (context.mode === 'quick') {
    markRoot(ipId, 'partial')
    return
  }

  const rdap = await lookupIp(ip, context.signal)
  record(context, sourceKey('rdap', 'ip', ip), rdap)
  if (rdap.data) {
    addRdapEntities(ipId, rdap)
  }

  if (network.data?.prefix) {
    const prefixOverview = await fetchPrefixOverview(network.data.prefix, context.signal)
    record(context, sourceKey('ripestat', 'prefix-overview', network.data.prefix), prefixOverview)
    if (prefixOverview.data) {
      const prefixEvidence = evidenceFrom(prefixOverview)
      const prefixId = `prefix:${network.data.prefix.toLowerCase()}`
      for (const entry of prefixOverview.data.asns) {
        const asn = `AS${entry.asn}`
        const asnNode = createNode({ type: 'asn', identifier: asn, evidence: prefixEvidence })
        if (addNodeSafe(asnNode)) {
          addEdgeSafe(
            createEdge({ type: 'HAS_ORIGIN_ASN', source: prefixId, target: asnNode.id, evidence: prefixEvidence }),
          )
        }
      }
      for (const related of prefixOverview.data.relatedPrefixes.slice(0, 10)) {
        const node = createNode({ type: 'prefix', identifier: related, evidence: prefixEvidence })
        if (addNodeSafe(node)) {
          addEdgeSafe(
            createEdge({ type: 'RELATED_PREFIX', source: prefixId, target: node.id, evidence: prefixEvidence }),
          )
        }
      }
    }
  }

  const lookingGlass = await fetchLookingGlass(ip, context.signal)
  record(context, sourceKey('ripestat', 'looking-glass', ip), lookingGlass)
  if (lookingGlass.data) {
    const lgEvidence = evidenceFrom(lookingGlass)
    for (const collector of lookingGlass.data.collectors.slice(0, 10)) {
      const collectorNode = createNode({
        type: 'route-collector',
        identifier: collector.rrc ?? collector.location ?? 'RIPE RIS',
        label: collector.rrc ? `RRC ${collector.rrc}` : 'RIPE RIS',
        evidence: lgEvidence,
        metadata: { location: collector.location },
      })
      if (addNodeSafe(collectorNode)) {
        addEdgeSafe(
          createEdge({ type: 'HAS_ROUTE_COLLECTOR', source: ipId, target: collectorNode.id, evidence: lgEvidence }),
        )
      }
      for (const peer of collector.peers.slice(0, 10)) {
        if (!peer.asnOrigin) continue
        const asn = `AS${peer.asnOrigin}`
        const peerNode = createNode({ type: 'bgp-peer', identifier: asn, evidence: lgEvidence })
        if (addNodeSafe(peerNode)) {
          addEdgeSafe(
            createEdge({
              type: 'BGP_PEER_OF',
              source: collectorNode.id,
              target: peerNode.id,
              evidence: lgEvidence,
              metadata: { asPath: peer.asPath, nextHop: peer.nextHop, lastUpdated: peer.lastUpdated },
            }),
          )
        }
        const asnNode = createNode({ type: 'asn', identifier: asn, evidence: lgEvidence })
        if (addNodeSafe(asnNode)) {
          addEdgeSafe(
            createEdge({
              type: 'OBSERVED_IN_ROUTE',
              source: collectorNode.id,
              target: asnNode.id,
              evidence: lgEvidence,
              metadata: { asPath: peer.asPath },
            }),
          )
        }
      }
    }
  }

  const abuse = await fetchAbuseContact(ip, context.signal)
  record(context, sourceKey('ripestat', 'abuse-contact-finder', ip), abuse)
  if (abuse.data) {
    for (const contact of abuse.data.contacts) {
      const org = createNode({ type: 'organization', identifier: contact, evidence: evidenceFrom(abuse) })
      if (addNodeSafe(org)) {
        addEdgeSafe(createEdge({ type: 'HAS_ABUSE_CONTACT', source: ipId, target: org.id, evidence: evidenceFrom(abuse) }))
      }
    }
  }

  if (network.data?.prefix && network.data.asns[0]) {
    const rpki = await fetchRpkiValidation(`AS${network.data.asns[0]}`, network.data.prefix, context.signal)
    record(context, sourceKey('ripestat', 'rpki-validation', `${ip}:${network.data.prefix}`), rpki)
    if (rpki.data) {
      const prefixId = `prefix:${network.data.prefix.toLowerCase()}`
      const prefixNode = useGraphStore.getState().nodes[prefixId]
      if (prefixNode) {
        useGraphStore.getState().addNode({
          ...prefixNode,
          metadata: { ...prefixNode.metadata, rpki: rpki.data },
        })
      }
    }
  }

  await processRoutingHistory(context, ip)
  markRoot(ipId, 'explored')
}

async function processDomain(context: RunContext, domain: string, rootId: string): Promise<void> {
  const quick = context.mode === 'quick'
  const types: DnsRecordType[] = quick ? ['A', 'AAAA'] : ['A', 'AAAA', 'CNAME', 'MX', 'NS', 'TXT', 'SOA', 'CAA']

  const results = await Promise.all(
    types.map((type) => queryCloudflareDns(domain, type, context.signal)),
  )

  let googleChecked = false
  if (!quick) {
    const google = await queryGoogleDns(domain, 'A', context.signal)
    record(context, sourceKey('google-dns', 'A', domain), google)
    googleChecked = true
    if (google.data) {
      const root = useGraphStore.getState().nodes[rootId]
      if (root) addDnsRecords(google, root, domain)
    }
  }

  const root = useGraphStore.getState().nodes[rootId]
  if (!root) return
  const discoveredIps: string[] = []
  for (const result of results) {
    record(context, sourceKey('cloudflare-dns', result.data?.type ?? 'unknown', domain), result)
    discoveredIps.push(...addDnsRecords(result, root, domain))
  }

  if (!quick) {
    const rdap = await lookupDomain(domain, context.signal)
    record(context, sourceKey('rdap', 'domain', domain), rdap)
    if (rdap.data) {
      addRdapEntities(rootId, rdap)
      const evidence = evidenceFrom(rdap, 'authoritative')
      for (const nameserver of rdap.data.nameservers) {
        const node = createNode({ type: 'nameserver', identifier: nameserver.toLowerCase(), evidence })
        if (addNodeSafe(node)) {
          addEdgeSafe(createEdge({ type: 'HAS_NS', source: rootId, target: node.id, evidence }))
        }
      }
      if (rdap.data.events.length > 0) {
        useGraphStore.getState().addNode({
          ...root,
          metadata: {
            ...root.metadata,
            registrationEvents: rdap.data.events,
            registrationStatus: rdap.data.status,
            handle: rdap.data.handle,
          },
        })
      }
    }

    const ct = await searchCertificates(domain, context.signal)
    record(context, sourceKey('crt-sh', 'domain', domain), ct)
    if (ct.data) {
      addCertificates(context, rootId, domain, ct)
    }
  }

  const uniqueIps = [...new Set(discoveredIps)].slice(0, MAX_IPS)
  await Promise.allSettled(uniqueIps.map((ip) => processIp(context, ip)))

  if (!quick) {
    const asns = Object.values(useGraphStore.getState().nodes)
      .filter((node) => node.type === 'asn')
      .map((node) => node.identifier)
    for (const asn of asns.slice(0, 20)) {
      await processAsn(context, asn)
    }
  }

  const hasData = Object.keys(useGraphStore.getState().nodes).length > 1
  markRoot(rootId, hasData ? 'explored' : 'no-data', hasData ? undefined : 'Источники не вернули данных')
  void googleChecked
}

function addCertificates(
  context: RunContext,
  rootId: string,
  zone: string,
  result: SourceResult<{ domain: string; certificates: Array<{ id: number; commonName?: string; names: string[]; issuerName?: string; notBefore?: string; notAfter?: string; serialNumber?: string }>; url: string }>,
): void {
  if (!result.data) return
  const evidence = evidenceFrom(result)
  const zoneParts = zone.split('.')
  const seenNames = new Set<string>()

  for (const certificate of result.data.certificates.slice(0, MAX_CERTIFICATES)) {
    const certId = `certificate:${certificate.id}`
    const certNode = createNode({
      type: 'certificate',
      identifier: String(certificate.id),
      label: certificate.commonName ?? `Certificate ${certificate.id}`,
      evidence,
      metadata: {
        commonName: certificate.commonName,
        issuerName: certificate.issuerName,
        notBefore: certificate.notBefore,
        notAfter: certificate.notAfter,
        serialNumber: certificate.serialNumber,
        names: certificate.names,
      },
      loadState: 'explored',
      completeness: 'complete',
    })
    if (!addNodeSafe(certNode)) break
    addEdgeSafe(createEdge({ type: 'HAS_CERTIFICATE', source: rootId, target: certId, evidence }))

    for (const name of certificate.names) {
      if (seenNames.size >= MAX_NAMES) break
      const clean = name.replace(/^\*\./, '')
      if (clean === zone || !clean.endsWith(`.${zone}`)) continue
      if (!clean.split('.').includes(zoneParts[zoneParts.length - 2] ?? '')) continue
      if (seenNames.has(clean)) continue
      seenNames.add(clean)
      const domainNode = createNode({ type: 'domain', identifier: clean, evidence })
      if (addNodeSafe(domainNode)) {
        addEdgeSafe(createEdge({ type: 'CERTIFICATE_COVERS', source: certId, target: domainNode.id, evidence }))
        addEdgeSafe(createEdge({ type: 'HAS_SUBDOMAIN', source: rootId, target: domainNode.id, evidence }))
      }
    }
  }
  void context
}

async function processPrefix(context: RunContext, prefix: string): Promise<void> {
  const prefixId = `prefix:${prefix.toLowerCase()}`
  const overview = await fetchPrefixOverview(prefix, context.signal)
  record(context, sourceKey('ripestat', 'prefix-overview', prefix), overview)
  if (overview.data) {
    const evidence = evidenceFrom(overview)
    for (const entry of overview.data.asns) {
      const asn = `AS${entry.asn}`
      const asnNode = createNode({ type: 'asn', identifier: asn, evidence })
      if (addNodeSafe(asnNode)) {
        addEdgeSafe(createEdge({ type: 'ANNOUNCED_BY', source: prefixId, target: asnNode.id, evidence }))
      }
    }
    for (const related of overview.data.relatedPrefixes.slice(0, 10)) {
      const node = createNode({ type: 'prefix', identifier: related, evidence })
      if (addNodeSafe(node)) {
        addEdgeSafe(createEdge({ type: 'RELATED_PREFIX', source: prefixId, target: node.id, evidence }))
      }
    }
  }

  const rdap = await lookupIp(prefix.split('/')[0], context.signal)
  record(context, sourceKey('rdap', 'ip', prefix), rdap)
  if (rdap.data) addRdapEntities(prefixId, rdap)

  const asns = Object.values(useGraphStore.getState().nodes)
    .filter((node) => node.type === 'asn')
    .map((node) => node.identifier)
  for (const asn of asns.slice(0, 20)) {
    await processAsn(context, asn)
  }
  markRoot(prefixId, 'explored')
}

export async function runInvestigation(
  input: NormalizedInput,
  mode: InvestigationMode,
  signal: AbortSignal,
): Promise<void> {
  const store = useGraphStore.getState()
  store.reset()
  const root = rootNode(input)
  const investigation: Investigation = {
    id: newId(),
    input: input.display,
    normalized: input.value,
    inputType: input.type,
    mode,
    status: 'collecting',
    startedAt: new Date().toISOString(),
    rootNodeId: root.id,
    sourceResults: {},
    counts: {
      nodes: 1,
      edges: 0,
      sourcesOk: 0,
      sourcesPartial: 0,
      sourcesFailed: 0,
      deferred: 0,
    },
    errors: [],
  }
  useGraphStore.getState().setInvestigation(investigation)
  useGraphStore.getState().addNode(root)

  const context: RunContext = {
    signal,
    mode,
    seenAsns: new Set(),
    seenIps: new Set(),
    seenPrefixes: new Set(),
    deferred: 0,
  }

  try {
    if (input.type === 'domain') {
      await processDomain(context, input.value, root.id)
    } else if (input.type === 'ipv4' || input.type === 'ipv6') {
      await processIp(context, input.value)
      markRoot(root.id, useGraphStore.getState().nodes[root.id]?.loadState ?? 'partial')
    } else if (input.type === 'asn') {
      await processAsn(context, input.value)
    } else if (input.type === 'cidr') {
      await processPrefix(context, input.value)
    }

    const status = signal.aborted ? 'cancelled' : 'complete'
    useGraphStore.getState().updateInvestigation({
      status,
      finishedAt: new Date().toISOString(),
      counts: {
        ...useGraphStore.getState().investigation!.counts,
        deferred: context.deferred,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка'
    useGraphStore.getState().updateInvestigation({
      status: signal.aborted ? 'cancelled' : 'error',
      finishedAt: new Date().toISOString(),
      errors: [message],
    })
    markRoot(root.id, 'error', message)
  }
}

export function isSupportedInput(type: InputType): boolean {
  return type !== 'unknown' && type !== 'url'
}
