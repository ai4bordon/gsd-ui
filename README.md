# GSD UI

Local web dashboard for visualizing [GSD (Get Shit Done)](https://github.com/gsd-build/get-shit-done) project planning data from `.planning/`.

Fork repository: https://github.com/ai4bordon/gsd-ui  
Forked from upstream: https://github.com/Stolkmeister/gsd-ui

Russian documentation: [README.ru.md](README.ru.md)

![Roadmap View](docs/screenshots/roadmap.png)

## Short Fork Note

This fork improves real-world `.planning` compatibility: milestone/phase mapping is now more accurate, requirements and roadmap statuses are reconciled, parser edge-cases are handled more robustly, and navigation/live updates are more consistent.

## Features

- Project dashboard with configuration, status, and session continuity
- Roadmap and milestone views with phase cards and progress
- Requirements table with status, milestone filtering, and traceability links
- Research document browser (phase research + standalone research)
- Plan and phase pages with summaries, verification, context, and UAT artifacts
- Decisions log aggregated from `*-SUMMARY.md` files
- Velocity analytics with duration and progress charts
- Todo view with pending/completed grouping
- Full-text search across plans, summaries, docs, milestones, and todos
- Live updates via WebSocket when `.planning/` files change

## Screenshots

<table>
<tr>
<td width="50%">

**Phase View** - Plans grouped by wave, verification status, and research docs

![Phase View](docs/screenshots/phase.png)

</td>
<td width="50%">

**Plan View** - Metadata, requirements, decisions, and execution summary

![Plan View](docs/screenshots/plan.png)

</td>
</tr>
<tr>
<td width="50%">

**Velocity** - Duration charts, cumulative progress, and plans per phase

![Velocity](docs/screenshots/velocity.png)

</td>
<td width="50%">

**Todos** - Pending and completed items with expandable details

![Todos](docs/screenshots/todos.png)

</td>
</tr>
</table>

## Quick Start

Prerequisite: [Bun](https://bun.sh)

```bash
bun install -g github:ai4bordon/gsd-ui
gsd-ui
```

Run from any directory containing `.planning/`, or pass a path explicitly:

```bash
gsd-ui /path/to/your/project
gsd-ui --port 3000
```

Open http://localhost:4567

### CLI Options

```
Usage:
  gsd-ui [options] [path]

Options:
  -h, --help       Show this help message
  -v, --version    Show version number
  -p, --port NUM   Port to listen on (default: 4567, or PORT env)
```

If multiple `.planning/` directories are detected (cwd + one level below), an interactive picker is shown.

## What Changed In This Fork

Compared to upstream (`Stolkmeister/gsd-ui`), this fork adds compatibility and UX fixes:

- Fixed file watcher behavior for `.planning` dot-folder roots
- Added roadmap milestone merge from both:
  - `.planning/ROADMAP.md`
  - `.planning/milestones/*/ROADMAP.md`
- Synced roadmap milestones with requirements milestones (for example `v2`)
- Added derived milestone phases for requirements-only milestones
- Improved fallback roadmap parsing for English and Russian formats (`Phase/Goal`, `Фаза/Цель`)
- Improved requirements parsing for section milestone extraction and traceability references
- Fixed `fulfilledByPlans` normalization and plan-link behavior in Requirements view
- Improved decisions parsing from summary files (table format and list format)
- Added velocity fallback derived from plan summaries when `STATE.md` has no velocity aggregates
- Added robust duration parsing (`22m`, `3m 52s`, `12min`, `00:06:00`, and similar)
- Fixed Research indexing updates when phase files change
- Highlighted `SUMMARY.md` files inside `.planning/research/` as Research Summary cards
- Fixed document breadcrumbs for research-origin navigation (`Research -> ...`)
- Added current project path badge in the sidebar
- Added automated parser/state test coverage

## Tests Added In This Fork

- `server/parsers/summary.test.ts`
- `server/parsers/roadmap.test.ts`
- `server/parsers/requirements.test.ts`
- `server/state.test.ts`

Run tests:

```bash
bun test
```

## Platform Validation

- Tested on **Windows 10**
- Verified with mixed-language `.planning` content (English + Russian)

## Development

Development and maintainer workflow: [DEVELOPMENT.md](DEVELOPMENT.md)

```bash
git clone https://github.com/ai4bordon/gsd-ui.git
cd gsd-ui
bun install

# Terminal 1: backend server
bun cli.ts /path/to/your/project

# Terminal 2: frontend dev server
bun run dev
```

Vite dev server proxies `/api` and `/ws` to backend (default port 4567).

## Try It With Demo Data

```bash
bun run build
bun cli.ts demo
```

## How It Works

GSD UI reads `.planning/` (markdown + YAML frontmatter), builds a structured state tree, and serves a React UI.

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

### Architecture

```
Browser  <--- WebSocket --->  Bun Server  <--- chokidar --->  .planning/
         <------ HTTP ------>             (markdown parsers + state builder)
```

- Server (`server/`): Bun HTTP API + WebSocket, parser pipeline, live updates
- Frontend (`src/`): React SPA with client routing and live state updates

### Routes

| Route | View | Description |
|-------|------|-------------|
| `/` | Project | Project status and configuration overview |
| `/roadmap` | Roadmap | Milestones and project-level roadmap metrics |
| `/milestone/:version` | Milestone | Phase cards and progress for one milestone |
| `/phase/:number` | Phase | Plans, verification, research/context/UAT tabs |
| `/plan/:phase/:plan` | Plan | Plan metadata + tabs (objective/tasks/context/summary) |
| `/requirements` | Requirements | Requirement status + milestone filtering + traceability |
| `/research` | Research | Phase and standalone research documents |
| `/todos` | Todos | Pending/done todo items |
| `/decisions` | Decisions | Aggregated decisions from summaries |
| `/velocity` | Velocity | Duration and progress analytics |
| `/search` | Search | Full-text search across all parsed content |
| `/document/*` | Document | Markdown document viewer |

## Tech Stack

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
| `GET /api/state` | Full project state (phases, milestones, requirements, research, todos, search index) |
| `GET /api/search?q=...` | Full-text search (ranked, capped results) |
| `GET /api/document?path=...` | Raw markdown content for a file inside `.planning/` |
| `WS /ws` | State push on connect and on file updates |

## Security

GSD UI is designed as a local tool:

- Binds to `127.0.0.1` only
- Path traversal protection for static/document access
- Document API restricted to `.planning/`
- WebSocket Origin validation
- Absolute paths sanitized in client-facing content
- JS frontmatter engine disabled in `gray-matter`

## License

MIT
