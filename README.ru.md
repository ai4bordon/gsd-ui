# GSD UI

Локальный веб-дашборд для визуализации данных планирования GSD из `.planning/`.

Репозиторий форка: https://github.com/ai4bordon/gsd-ui  
Форк сделан из upstream: https://github.com/Stolkmeister/gsd-ui

English documentation: [README.md](README.md)

![Roadmap View](docs/screenshots/roadmap.png)

## Возможности

- Дашборд проекта с конфигурацией, статусом и continuity-секцией
- Roadmap и Milestone-экраны с фазами и прогрессом
- Таблица требований с фильтрацией по milestone и traceability
- Просмотр Research-документов (phase research + standalone research)
- Страницы фазы и плана с summary, verification, context и UAT
- Журнал решений, собранный из `*-SUMMARY.md`
- Velocity-аналитика с графиками длительности и прогресса
- Вкладка Todo с группировкой pending/completed
- Полнотекстовый поиск по планам, summary, документам, milestones и todo
- Live-обновления через WebSocket при изменениях в `.planning/`

## Скриншоты

<table>
<tr>
<td width="50%">

**Phase View** - планы по wave, статусы verification и research-документы

![Phase View](docs/screenshots/phase.png)

</td>
<td width="50%">

**Plan View** - метаданные, требования, решения и execution summary

![Plan View](docs/screenshots/plan.png)

</td>
</tr>
<tr>
<td width="50%">

**Velocity** - графики длительности, накопленного прогресса и количества планов

![Velocity](docs/screenshots/velocity.png)

</td>
<td width="50%">

**Todos** - pending/completed элементы с раскрытием деталей

![Todos](docs/screenshots/todos.png)

</td>
</tr>
</table>

## Быстрый старт

Требование: [Bun](https://bun.sh)

```bash
bun install -g github:ai4bordon/gsd-ui
gsd-ui
```

Запускай из директории, где есть `.planning/`, или передавай путь явно:

```bash
gsd-ui /path/to/your/project
gsd-ui --port 3000
```

Открой http://localhost:4567

### CLI Опции

```
Usage:
  gsd-ui [options] [path]

Options:
  -h, --help       Show this help message
  -v, --version    Show version number
  -p, --port NUM   Port to listen on (default: 4567, or PORT env)
```

Если найдено несколько `.planning/` (cwd + один уровень вложенности), появится интерактивный выбор.

## Что изменено в этом форке

По сравнению с upstream (`Stolkmeister/gsd-ui`) добавлены совместимость и UX-фиксы:

- Исправлен watcher для `.planning` (dot-folder root)
- Добавлено объединение milestones из:
  - `.planning/ROADMAP.md`
  - `.planning/milestones/*/ROADMAP.md`
- Добавлена синхронизация milestones roadmap с milestones из requirements (например `v2`)
- Добавлены производные фазы для milestones, которые есть только в requirements
- Улучшен fallback-парсинг roadmap для EN/RU форматов (`Phase/Goal`, `Фаза/Цель`)
- Улучшен парсинг requirements (извлечение milestone из секций + traceability refs)
- Исправлена нормализация `fulfilledByPlans` и поведение ссылок в Requirements
- Улучшен парсинг decisions из summary (таблица и список)
- Добавлен fallback расчета velocity из summary, если в `STATE.md` нет агрегатов
- Добавлен устойчивый парсинг длительности (`22m`, `3m 52s`, `12min`, `00:06:00` и т.д.)
- Исправлено обновление индекса Research при изменениях в phase-файлах
- Добавлено визуальное выделение `SUMMARY.md` внутри `.planning/research/` как Research Summary
- Исправлены хлебные крошки в документе для навигации из Research (`Research -> ...`)
- Добавлен бейдж текущего пути проекта в сайдбаре
- Добавлено автотест-покрытие парсеров и state-сборки

## Тесты, добавленные в форке

- `server/parsers/summary.test.ts`
- `server/parsers/roadmap.test.ts`
- `server/parsers/requirements.test.ts`
- `server/state.test.ts`

Запуск:

```bash
bun test
```

## Проверка платформы

- Протестировано на **Windows 10**
- Проверено на смешанном `.planning` контенте (английский + русский)

## Разработка

Гайд для разработки и сопровождения форка: [DEVELOPMENT.md](DEVELOPMENT.md)

```bash
git clone https://github.com/ai4bordon/gsd-ui.git
cd gsd-ui
bun install

# Терминал 1: backend
bun cli.ts /path/to/your/project

# Терминал 2: frontend dev server
bun run dev
```

Vite dev server проксирует `/api` и `/ws` на backend (по умолчанию порт 4567).

## Демоданные

```bash
bun run build
bun cli.ts demo
```

## Как это работает

GSD UI читает `.planning/` (markdown + YAML frontmatter), строит структурированное состояние и отдает React UI.

```
your-project/
  .planning/
    config.json
    PROJECT.md
    STATE.md
    ROADMAP.md
    REQUIREMENTS.md
    phases/
      01-feature-name/
        01-01-PLAN.md
        01-01-SUMMARY.md
        01-VERIFICATION.md
        01-RESEARCH.md
      02-another-feature/
        ...
    todos/
      pending/
      done/
    research/
```

### Архитектура

```
Browser  <--- WebSocket --->  Bun Server  <--- chokidar --->  .planning/
         <------ HTTP ------>             (markdown parsers + state builder)
```

- Server (`server/`): Bun HTTP API + WebSocket, парсеры, live-updates
- Frontend (`src/`): React SPA с роутингом и live state

### Роуты

| Route | View | Description |
|-------|------|-------------|
| `/` | Project | Сводка статуса проекта и конфигурации |
| `/roadmap` | Roadmap | Milestone-лента и roadmap-метрики |
| `/milestone/:version` | Milestone | Фазы и прогресс по milestone |
| `/phase/:number` | Phase | Планы, verification, research/context/UAT |
| `/plan/:phase/:plan` | Plan | Метаданные плана + вкладки контента |
| `/requirements` | Requirements | Статусы требований + фильтрация + traceability |
| `/research` | Research | Phase и standalone research документы |
| `/todos` | Todos | Pending/done задачи |
| `/decisions` | Decisions | Сводный журнал решений из summary |
| `/velocity` | Velocity | Аналитика длительности и прогресса |
| `/search` | Search | Полнотекстовый поиск по всем артефактам |
| `/document/*` | Document | Просмотр markdown-документов |

## Технологии

| Layer | Technology |
|-------|------------|
| Runtime | [Bun](https://bun.sh) |
| Frontend | React 19, React Router 7, Tailwind CSS 4 |
| Charts | Recharts |
| Markdown | react-markdown + remark-gfm |
| Icons | Lucide React |
| Build | Vite 7 |
| File watch | chokidar |
| Frontmatter parsing | gray-matter |

## API

| Endpoint | Description |
|----------|-------------|
| `GET /api/state` | Полное состояние проекта (phases, milestones, requirements, research, todos, search index) |
| `GET /api/search?q=...` | Полнотекстовый поиск (ранжирование, лимит выдачи) |
| `GET /api/document?path=...` | Исходный markdown для файла внутри `.planning/` |
| `WS /ws` | Push состояния при подключении и изменениях файлов |

## Безопасность

GSD UI задуман как локальный инструмент:

- Биндится только на `127.0.0.1`
- Есть защита от path traversal
- Document API ограничен директорией `.planning/`
- WebSocket проверяет Origin
- Абсолютные пути санитизируются в клиентском ответе
- JS frontmatter engine отключен в `gray-matter`

## License

MIT
