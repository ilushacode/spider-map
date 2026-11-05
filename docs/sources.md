# Источники данных

Проверка доступности из браузера выполнялась запросами с заголовком `Origin: http://localhost:5173`.

| Источник | Endpoint | CORS | Статус на момент аудита | Документация |
|---|---|---|---|---|
| Cloudflare DNS | `https://cloudflare-dns.com/dns-query` | `*` | 200 | https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/make-api-requests/ |
| Google Public DNS | `https://dns.google/resolve` | `*` | 200 | https://developers.google.com/speed/public-dns/docs/doh/json |
| RIPEstat | `https://stat.ripe.net/data/{endpoint}/data.json` | `*` | 200 | https://stat.ripe.net/docs/data-api/ripestat-data-api |
| IANA RDAP bootstrap | `https://data.iana.org/rdap/{dns,ipv4,ipv6,asn}.json` | `*` | 200 | https://www.icann.org/rdap/ |
| Verisign RDAP | `https://rdap.verisign.com/com/v1/` | `*` | 200 | https://www.icann.org/rdap/ |
| ARIN RDAP | `https://rdap.arin.net/registry/` | `*` | 200 | https://www.icann.org/rdap/ |
| crt.sh | `https://crt.sh/?q=...&output=json` | неизвестно | 502 во время проверки | https://crt.sh/ |

## Примечания

- RDAP-серверы выбираются по bootstrap-файлам IANA, а не зашиты в код. Хосты, полученные из bootstrap, регистрируются в allowlist HTTP-клиента.
- crt.sh — дополнительный источник. При недоступности, CORS-ошибке или превышении лимита исследование продолжается без сертификатов, статус источника отображается в UI.
- Приложение не использует прокси, бэкенд или обход CORS. Если источник недоступен из браузера, это показывается как ошибка источника.
- RIPEstat получает параметр `sourceapp=spider-map` для идентификации приложения.

## Лимиты и кэш

| Категория | TTL |
|---|---|
| DNS | 5 минут |
| RIPEstat | 15 минут |
| RDAP bootstrap | 24 часа |
| RDAP lookup | 6 часов |
| Certificate Transparency | 6 часов |

HTTP-клиент: не более 8 одновременных запросов, не более 2 к одному хосту, таймаут 12 секунд, до 2 повторов для 429/5xx с экспоненциальной задержкой и jitter. Повторные одинаковые запросы дедуплицируются, успешные ответы кэшируются.
