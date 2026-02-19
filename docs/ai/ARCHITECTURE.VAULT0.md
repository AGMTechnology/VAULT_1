# Architecture

## Stack

- Next.js App Router (UI + API routes)
- TypeScript
- Prisma + SQLite (`prisma/dev.db`)
- Tailwind CSS
- Local file storage (`data/projects/*`)

## Useful folders

- `app/`
  - `page.tsx`: app entry page
  - `api/*`: HTTP endpoints
- `components/dashboard.tsx`: main UI
- `lib/repositories/*`: DB access layer
- `lib/services/*`: business services
- `lib/validators/*`: Zod validation schemas
- `prisma/schema.prisma`: data model
- `scripts/*`: PM and Dev automation scripts
- `data/projects/<projectId>/`: memory + markdown exports

## Backend flow

1. API route receives JSON input.
2. Zod validates payload.
3. Repository reads/writes via Prisma.
4. Service layer handles advanced logic (handoff, export, memory, ID generation).
5. API returns JSON response.

## Data model summary

### Project
- `id`, `name`, `description`, `repoPath`, `figmaLink`, `agentsConfiguration`, `conventions`, timestamps

### Ticket
- `id`, `projectId`, `title`, `type`, `priority`, `status`
- `assignee`, `estimate`
- `specMarkdown`, `acceptanceCriteria`, `testPlan`
- `dependencies`, `labels` (stored as JSON strings in DB)
- `position`, timestamps

### Comment
- `id`, `ticketId`, `author`, `bodyMd`, timestamps

### AuditLog
- `id`, `ticketId`, `actor`, `action`, `payload`, `createdAt`

### PromptPreset
- `id`, `kind` (`PM|DEV|DESIGN`), `content`, timestamps

### Sequence
- counter used for ticket ID generation

## File persistence

- Memory: `data/projects/<projectId>/memory/sessions.jsonl`
- Ticket markdown exports: `data/projects/<projectId>/tickets/<ticketId>.md`

## Key rules

1. `projectId` is required for listing and creating tickets.
2. `POST /api/tickets` verifies that project exists.
3. Supported statuses:
   - `backlog`, `to-qualify`, `ready`, `in-progress`, `in-review`, `blocked`, `ask-boss`, `done`
4. Supported priorities:
   - `P0`, `P1`, `P2`, `P3`
