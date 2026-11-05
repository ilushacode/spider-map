import {
  Boxes,
  Building2,
  FileText,
  Globe,
  MapPin,
  Network,
  Radio,
  Server,
  ShieldCheck,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { NodeType } from '../../graph/types'

export type GraphGroupId =
  | 'domains'
  | 'dns'
  | 'ip'
  | 'prefix'
  | 'asn'
  | 'registration'
  | 'certificates'
  | 'routing'
  | 'geo'

export interface GraphGroup {
  id: GraphGroupId
  label: string
  types: NodeType[]
  color: string
  icon: LucideIcon
}

export const GRAPH_GROUPS: GraphGroup[] = [
  { id: 'domains', label: 'Домены', types: ['domain'], color: '#77b7c9', icon: Globe },
  {
    id: 'dns',
    label: 'DNS',
    types: ['dns-record', 'nameserver', 'mail-server'],
    color: '#8f9aa8',
    icon: FileText,
  },
  { id: 'ip', label: 'IP-адреса', types: ['ip'], color: '#7f9fce', icon: Server },
  { id: 'prefix', label: 'Префиксы', types: ['prefix'], color: '#a79ad6', icon: Network },
  { id: 'asn', label: 'ASN', types: ['asn'], color: '#d6a35c', icon: Boxes },
  {
    id: 'registration',
    label: 'Регистрация',
    types: ['registrar', 'organization', 'rir'],
    color: '#c68fa0',
    icon: Building2,
  },
  { id: 'certificates', label: 'Сертификаты', types: ['certificate'], color: '#7fbf8f', icon: ShieldCheck },
  {
    id: 'routing',
    label: 'Маршрутизация',
    types: ['route-collector', 'bgp-peer'],
    color: '#a58fbf',
    icon: Radio,
  },
  {
    id: 'geo',
    label: 'География',
    types: ['geographic-location'],
    color: '#9aa88f',
    icon: MapPin,
  },
]

export function getGraphGroup(id: GraphGroupId): GraphGroup {
  return GRAPH_GROUPS.find((group) => group.id === id) ?? GRAPH_GROUPS[0]
}
