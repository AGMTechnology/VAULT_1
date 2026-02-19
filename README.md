# VAULT_1 Desktop

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
- VAULT_0 API bridge for shared data import (agents/tickets/memory visibility)

## Architecture

- Runtime: Electron (main + preload + renderer)
- Renderer: React + Vite
- Local persistence: SQLite (`better-sqlite3`) + JSONL memory files
- IPC boundary: typed channels in `src/shared/ipc.ts`
- Core domain service: `src/main/core/vault-core.ts`
- VAULT_0 bridge and sharing primitives in `vault-core` + IPC bridge channels

## Data location

By default, VAULT_1 stores data under Electron `app.getPath("userData")`:

- SQLite DB: `vault1.db`
- Project data root: `data/projects/<projectId>/...`
  - memory: `memory/sessions.jsonl`
  - ticket exports: `tickets/<ticketId>.md`

## Local run

```bash
cd VAULT_1
npm install
npm run dev
```

`npm run dev` runs the desktop app with hot reload (Electron + Vite), not a browser-only app.
The script automatically rebuilds `better-sqlite3` for Electron ABI before launch.

## Build and start

```bash
cd VAULT_1
npm run build
npm run start
```

`npm run start` is the desktop launcher flow used by the Windows shortcut.
It rebuilds `better-sqlite3` for Electron ABI and then opens the Electron client.

If you need to recreate the desktop shortcut:

```bash
npm run shortcut:create
```

## Tests (TDD core)

```bash
cd VAULT_1
npm test
```

`npm test` rebuilds `better-sqlite3` for Node ABI before running Vitest.

Current tests cover:

- ticket ID generation and mandatory project linkage
- local project plug validation
- chat persistence/filtering by agent
- handoff generation with last memory entries

## Scope notes

This delivery is a robust MVP foundation aligned with ticket `VAULT-0-048`:

- Core parity modules from VAULT_0 are scaffolded and operational in desktop context.
- Dedicated repository separation is enforced from VAULT_0.
- Desktop shortcut automation script is provided in `scripts/`.
