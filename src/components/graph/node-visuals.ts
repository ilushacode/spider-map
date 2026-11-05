import {
  Boxes,
  Building2,
  Cable,
  FileText,
  Globe,
  HelpCircle,
  Landmark,
  Mail,
  MapPin,
  Network,
  Radio,
  Server,
  ShieldCheck,
  Waypoints,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { EdgeType, NodeType } from '../../graph/types'

export interface NodeVisual {
  label: string
  color: string
  icon: LucideIcon
}

export const NODE_VISUALS: Record<NodeType, NodeVisual> = {
  domain: { label: 'Домен', color: '#77b7c9', icon: Globe },
  ip: { label: 'IP-адрес', color: '#7f9fce', icon: Server },
  prefix: { label: 'Префикс', color: '#a79ad6', icon: Network },
  asn: { label: 'ASN', color: '#d6a35c', icon: Boxes },
  organization: { label: 'Организация', color: '#c68fa0', icon: Building2 },
  'dns-record': { label: 'DNS-запись', color: '#8f9aa8', icon: FileText },
  nameserver: { label: 'DNS-сервер', color: '#89a9a2', icon: Cable },
  'mail-server': { label: 'Почтовый сервер', color: '#b3a17f', icon: Mail },
  certificate: { label: 'Сертификат', color: '#7fbf8f', icon: ShieldCheck },
  registrar: { label: 'Регистратор', color: '#b89a86', icon: Landmark },
  rir: { label: 'RIR', color: '#a29bb0', icon: Landmark },
  network: { label: 'Сеть', color: '#8c9bb3', icon: Network },
  'exchange-point': { label: 'Точка обмена', color: '#aab08c', icon: Waypoints },
  'geographic-location': { label: 'Геолокация', color: '#9aa88f', icon: MapPin },
  'route-collector': { label: 'Коллектор', color: '#a58fbf', icon: Radio },
  'bgp-peer': { label: 'BGP-пир', color: '#b08f8f', icon: Waypoints },
  unknown: { label: 'Неизвестно', color: '#7c828d', icon: HelpCircle },
}

export const EDGE_LABELS: Record<EdgeType, string> = {
  RESOLVES_TO: 'разрешается в',
  CNAME_TO: 'CNAME',
  HAS_MX: 'MX',
  HAS_NS: 'NS',
  HAS_DNS_RECORD: 'DNS',
  ANNOUNCED_BY: 'анонсируется',
  WITHIN_PREFIX: 'в префиксе',
  HAS_ORIGIN_ASN: 'origin ASN',
  HAS_REGISTRATION: 'регистрация',
  HAS_CERTIFICATE: 'сертификат',
  CERTIFICATE_COVERS: 'покрывает',
  REGISTERED_BY: 'регистратор',
  HAS_ABUSE_CONTACT: 'abuse',
  OBSERVED_IN_ROUTE: 'в маршруте',
  BGP_PEER_OF: 'BGP-пир',
  HAS_ROUTE_COLLECTOR: 'коллектор',
  HAS_GEOLOCATION: 'геоданные',
  RELATED_PREFIX: 'связан',
  SHARES_IP_WITH: 'общий IP',
  HAS_SUBDOMAIN: 'поддомен',
}

export const CONFIDENCE_LABELS = {
  authoritative: 'авторитетный',
  observed: 'наблюдаемый',
  corroborated: 'подтверждён',
  inferred: 'выведен',
  unknown: 'неизвестно',
} as const

export const LOAD_STATE_LABELS = {
  unexplored: 'не исследован',
  loading: 'загружается',
  partial: 'частично',
  explored: 'исследован',
  error: 'ошибка',
  'no-data': 'нет данных',
  'source-limited': 'ограничен источником',
} as const
