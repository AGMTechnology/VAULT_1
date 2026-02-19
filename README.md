# VAULT_1 Desktop (MVP)

VAULT_1 is a local-first desktop client that mirrors VAULT_0 workflow capabilities with a native runtime shell.

## Features in this MVP

- Multi-project management (create, archive/unarchive)
- Project plug from local git path
- Project plug from git clone URL
- Ticket workflow with project-scoped IDs (`<PROJECT>-XXX`)
- Board view with horizontal scrolling columns
- Ticket detail panel with status transitions
- Deterministic markdown ticket export to local filesystem
- Session memory append/read using JSONL per project
- Handoff generation (ticket + conventions + recent memory)
- Agent registry per project
- Integrated multi-agent chat (project-contextual)

## Architecture

- Runtime: Electron (main + preload + renderer)
- Renderer: React + Vite
- Local persistence: SQLite (`better-sqlite3`) + JSONL memory files
- IPC boundary: typed channels in `src/shared/ipc.ts`
- Core domain service: `src/main/core/vault-core.ts`

## Data location

By default, VAULT_1 stores data under Electron `app.getPath("userData")`:

- SQLite DB: `vault1.db`
- Project data root: `data/projects/<projectId>/...`
  - memory: `memory/sessions.jsonl`
  - ticket exports: `tickets/<ticketId>.md`

## Local run

```bash
cd vault1-desktop
npm install
npm run dev
```

## Build and start

```bash
cd vault1-desktop
npm run build
npm run start
```

## Tests (TDD core)

```bash
cd vault1-desktop
npm test
```

Current tests cover:

- ticket ID generation and mandatory project linkage
- local project plug validation
- chat persistence/filtering by agent
- handoff generation with last memory entries

## Scope notes

This delivery is a robust MVP foundation aligned with ticket `VAULT-0-047`:

- Core parity modules from VAULT_0 are scaffolded and operational in desktop context.
- Advanced UX polish, richer board interactions, and deeper module parity can be iterated on top of this base.
