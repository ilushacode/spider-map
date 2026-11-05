import type { Confidence, EdgeType } from './types'

export interface RelationshipInfo {
  label: string
  explanation: string
  confidence: Confidence
}

export const RELATIONSHIPS: Record<EdgeType, RelationshipInfo> = {
  RESOLVES_TO: {
    label: 'разрешается в',
    explanation: 'DNS-ответ сопоставляет имя с IP-адресом.',
    confidence: 'observed',
  },
  CNAME_TO: {
    label: 'CNAME',
    explanation: 'DNS-запись CNAME указывает каноническое имя.',
    confidence: 'authoritative',
  },
  HAS_MX: {
    label: 'почтовый сервер',
    explanation: 'MX-запись домена указывает на почтовый сервер.',
    confidence: 'authoritative',
  },
  HAS_NS: {
    label: 'DNS-сервер',
    explanation: 'NS-запись домена указывает авторитетные DNS-серверы.',
    confidence: 'authoritative',
  },
  HAS_DNS_RECORD: {
    label: 'DNS-запись',
    explanation: 'Домен содержит DNS-запись указанного типа.',
    confidence: 'authoritative',
  },
  ANNOUNCED_BY: {
    label: 'анонсируется',
    explanation: 'Префикс анонсируется указанным ASN по данным BGP.',
    confidence: 'observed',
  },
  WITHIN_PREFIX: {
    label: 'входит в префикс',
    explanation: 'IP-адрес принадлежит указанному маршрутизируемому префиксу.',
    confidence: 'observed',
  },
  HAS_ORIGIN_ASN: {
    label: 'origin ASN',
    explanation: 'Префикс имеет указанный origin ASN по данным маршрутизации.',
    confidence: 'observed',
  },
  HAS_REGISTRATION: {
    label: 'регистрация',
    explanation: 'Регистрационные данные RDAP для объекта.',
    confidence: 'authoritative',
  },
  HAS_CERTIFICATE: {
    label: 'сертификат',
    explanation: 'Домен встречается в сертификате из Certificate Transparency.',
    confidence: 'observed',
  },
  CERTIFICATE_COVERS: {
    label: 'покрывает имя',
    explanation: 'Сертификат содержит указанное имя в SAN или CN.',
    confidence: 'observed',
  },
  REGISTERED_BY: {
    label: 'регистратор',
    explanation: 'Регистрационные данные указывают registrar или registry.',
    confidence: 'authoritative',
  },
  HAS_ABUSE_CONTACT: {
    label: 'abuse-контакт',
    explanation: 'Опубликованный abuse-контакт для сетевого ресурса.',
    confidence: 'authoritative',
  },
  OBSERVED_IN_ROUTE: {
    label: 'наблюдается в маршруте',
    explanation: 'ASN или префикс наблюдается в AS path BGP-коллектора.',
    confidence: 'observed',
  },
  BGP_PEER_OF: {
    label: 'BGP-пир',
    explanation: 'Наблюдаемый BGP-пир указанного ASN.',
    confidence: 'observed',
  },
  HAS_ROUTE_COLLECTOR: {
    label: 'коллектор',
    explanation: 'Маршрут наблюдается указанным коллектором RIPE RIS.',
    confidence: 'observed',
  },
  HAS_GEOLOCATION: {
    label: 'геоданные',
    explanation: 'Приблизительная географическая привязка сетевого ресурса.',
    confidence: 'inferred',
  },
  RELATED_PREFIX: {
    label: 'связанный префикс',
    explanation: 'Источник сообщает о связанном префиксе.',
    confidence: 'observed',
  },
  SHARES_IP_WITH: {
    label: 'общий IP',
    explanation: 'Два имени разрешаются в один и тот же IP-адрес.',
    confidence: 'observed',
  },
  HAS_SUBDOMAIN: {
    label: 'поддомен',
    explanation: 'Имя является подтверждённым поддоменом указанной зоны.',
    confidence: 'observed',
  },
}
