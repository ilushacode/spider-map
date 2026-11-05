# AGENTS.md

## Что это за проект
`spider-map` — браузерный исследовательский инструмент: строит граф интернет-инфраструктуры (домены, IP, префиксы, ASN, RDAP, CT) из публичных API. Полное ТЗ и ограничения — в `TASK.md` (читать перед любой продуктовой работой). Проверенные источники и CORS — в `docs/sources.md`.

## Команды
- `npm run dev` — dev-сервер Vite
- `npm run build` — `tsc -b && vite build` (сначала типы, потом сборка)
- `npm run lint` — oxlint (конфиг `.oxlintrc.json`)
- `npm run preview` — просмотр собранной версии
- `npm test` — Vitest (jsdom, тесты рядом с кодом: `*.test.ts(x)`)

## Git и коммиты
- Репозиторий инициализирован; коммить после успешной реализации каждой крупной функции.
- Стиль сообщений — Conventional Commits: `feat: ...`, `fix: ...`, `refactor: ...`, `test: ...`, `docs: ...`, `chore: ...`.
- Перед коммитом проверяй `npm run build` и `npm run lint`; не коммить сломанную сборку.
- Не коммить `node_modules`, `dist`, секреты и временные файлы.

## Жёсткие ограничения (из TASK.md)
- Только frontend: React + TypeScript, `fetch` к публичным API прямо из браузера. Никакого backend, прокси для обхода CORS, сканеров.
- Запрещены выдуманные данные и связи; у каждого факта должен быть источник и категория уверенности.
- Не обходить лимиты внешних API; кэшировать и ограничивать параллелизм.
- UI обязателен по навыкам `flawless-ui-ux` и `unslop` (загружать через skill tool).

## Технические особенности
- TypeScript: `verbatimModuleSyntax` (импорты типов — `import type`), `erasableSyntaxOnly` (без enum/parameter properties), `noUnusedLocals`/`noUnusedParameters` — сборка падает на неиспользуемом коде.
- CSS пишется нативным вложенным синтаксисом (как в `src/App.css`), без препроцессоров.
- Точка входа: `src/main.tsx` → `src/App.tsx`; статика в `public/`.
- Стек: React Flow (`@xyflow/react`), Zustand (`graph-store.ts`), Zod (схемы ответов), dagre (раскладка), lucide-react (иконки).
- Данные и UI разделены: адаптеры в `src/services/sources/`, оркестратор в `src/features/investigation/`, модель графа в `src/graph/`.
