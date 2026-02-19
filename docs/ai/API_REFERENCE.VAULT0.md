# API Reference

Base URL:
- `http://localhost:3000`

Format:
- `Content-Type: application/json`
- JSON responses

Error format:
- `400`: validation issue (Zod)
- `409`: lock/concurrency issue
- `404`: resource not found
- `500`: internal error

---

## Projects

### `GET /api/projects`
List projects.

### `POST /api/projects`
Create project.

Minimal body:
```json
{ "name": "Project Alpha" }
```

Full body:
```json
{
  "name": "Project Alpha",
  "description": "",
  "repoPath": "",
  "figmaLink": "",
  "agentsConfiguration": "",
  "conventions": "",
  "isArchived": false
}
```

### `GET /api/projects/{id}`
Get project by ID.

### `PUT /api/projects/{id}`
Partial update project, including archive toggle (`isArchived: true|false`).

### `DELETE /api/projects/{id}`
Delete project (tickets cascade delete).

### `GET /api/projects/{id}/lock`
Get active project lock (if any).

### `DELETE /api/projects/{id}/lock?agentId=...&force=...`
Release active project lock.

### `GET /api/projects/{id}/docs`
Get required documentation checklist that must be reviewed before starting a ticket.

---

## Agents

### `GET /api/agents?projectId=...&includeInactive=...`
- `projectId` required
- `includeInactive` optional (`true` by default)

### `POST /api/agents`
Create an agent profile (personality + skills + rules + defaultPrompt + avatar).

Body:
```json
{
  "projectId": "cuid_project",
  "agentId": "senior-mobile-dev",
  "displayName": "Senior Mobile Dev",
  "role": "mobile developer",
  "personality": "senior, pragmatic, quality-focused",
  "skills": ["react-native", "typescript"],
  "rules": ["Follow TDD"],
  "defaultPrompt": "You are a senior mobile dev...",
  "avatarUrl": "",
  "isActive": true
}
```

### `GET /api/agents/{id}`
Get agent by ID.

### `PUT /api/agents/{id}`
Update agent profile (partial update, at least one field).

### `DELETE /api/agents/{id}`
Delete agent.

### `POST /api/agents/generate`
Generate an optimized agent profile from a simple prompt.

Body:
```json
{
  "projectId": "cuid_project",
  "prompt": "Je veux un agent dev mobile senior"
}
```

---

## Tickets

### `GET /api/tickets?projectId=...`
`projectId` is required.

Optional query params:
- `query`: free text search
- `status`: CSV list
- `type`: CSV list
- `priority`: CSV list
- `label`: CSV list
- `assignee`: text filter
- `sort`: `priority-desc` (default), `priority-asc`, `updated-desc`, `updated-asc`

Example:
`/api/tickets?projectId=abc&status=ready,in-progress&priority=P0,P1&sort=updated-desc`

### `POST /api/tickets`
Create ticket. `projectId` is mandatory and must exist.
Server-side ID format is project-based: `<PROJECT_NAME>-XXX` (example: `VAULT-0-001`).
Each created ticket includes a generated `referencePrompt` based on spec, acceptance criteria, test plan, dependencies, labels, and project rules.
The generated `referencePrompt` also enforces assigned-agent execution and role/persona embodiment.

Body:
```json
{
  "projectId": "cuid_project",
  "actor": "agent_record_id_optional",
  "title": "Implement login",
  "type": "story",
  "priority": "P1",
  "status": "ready",
  "assignee": "codex-dev",
  "estimate": 3,
  "specMarkdown": "As a user...",
  "acceptanceCriteria": "Given/When/Then...",
  "testPlan": "- unit\n- integration",
  "dependencies": ["FAIRLY-0004"],
  "labels": ["mobile", "auth"],
  "position": 0
}
```

Traceability fields:
- `lastActorId`: stored on ticket and updated on ticket/comment actions.

Enums:
- `type`: `story|feature|bug|task|chore`
- `priority`: `P0|P1|P2|P3`
- `status`: `backlog|to-qualify|ready|in-progress|in-review|blocked|ask-boss|done`

### `GET /api/tickets/{id}`
Get ticket by ID.

### `PUT /api/tickets/{id}`
Partial update ticket (at least one field).

Special fields:
- `actor`: optional, identifies who performed the transition.
- `blockerNote`: required when setting status to `ask-boss`.
- `docsReviewed`: required when moving to `in-progress`.
- `docsReviewedPaths`: optional list of reviewed docs; if omitted, server uses required project docs list.

Transition guard:
- `in-review` requires previous status `in-progress`.
- `in-review` also requires a ticket comment starting with `[DEV_DONE]` (completion evidence).
- `done` requires previous status `in-review`.
- Moving to `in-progress` is allowed only when actor matches the ticket assignee (or ticket is unassigned).
- For `bug` and workflow/regression labels, `done` also requires POST_MORTEM evidence:
  - a ticket comment starting with `[POST_MORTEM]`
  - a project memory entry containing `[POST_MORTEM]` and the ticket id

### `DELETE /api/tickets/{id}`
Delete ticket.

### `POST /api/tickets/{id}/export`
Export markdown to:
- `data/projects/<projectId>/tickets/<ticketId>.md`

### `GET /api/tickets/{id}/comments`
List comments (ascending by creation date).

### `POST /api/tickets/{id}/comments`
Create comment.

Body:
```json
{
  "author": "Senior Mobile Dev",
  "agentId": "agent_record_id_optional",
  "bodyMd": "Looks good"
}
```

### `GET /api/tickets/{id}/audit`
List audit entries (descending by creation date).

### `GET /api/tickets/next?projectId=...&agentId=...&autoClaim=...&includeHandoff=...&memoryLimit=...`
Get next `ready` ticket sorted by priority, then position, then creation date.

Params:
- `projectId` required
- `agentId`: optional, default `codex-dev`
- `autoClaim`: `true|false` (if true, updates status to `in-progress`)
- `includeHandoff`: `true|false`
- `memoryLimit`: 1..25
- `docsReviewed`: required when `autoClaim=true`
- `docsReviewedPaths`: optional CSV list of reviewed docs when `autoClaim=true`

When `autoClaim=true`, project lock is enforced so only one active agent can claim a project at a time.
When ticket assignee is set, only that assigned agent can claim/start the ticket.

### Agent completion policy (workflow)
Before moving a dev ticket to `in-review`:
- tests must be written/run in a TDD flow
- one commit must reference only the current ticket id
- latest commit must include test file changes
- commit must be pushed upstream
- ticket must contain a `[DEV_DONE]` evidence comment

Recommended command:
```powershell
.\scripts\agent-dev-complete-ticket.ps1 `
  -TicketId "<TICKET_ID>" `
  -RepoPath "<REPO_PATH>" `
  -TestEvidence "Added failing tests first, implemented fix, tests green"
```

---

## Memory

### `GET /api/memory?projectId=...&query=...&agentId=...&limit=...`
- `projectId` required
- `query` optional
- `agentId` optional (filter by specific agent memory)
- `limit` optional, default `100`

### `POST /api/memory`
Append memory entry.

Body:
```json
{
  "projectId": "cuid_project",
  "agentId": "agent_record_id_or_user",
  "task_summary": "Implemented FAIRLY-0012",
  "successes": [],
  "failures": [],
  "user_preferences": [],
  "user_frustrations": [],
  "decisions_taken": [],
  "lessons_learned": [],
  "files_changed": [],
  "commands_run": [],
  "next_session_focus": []
}
```

---

## Prompts

### `GET /api/prompts`
List prompt presets. Creates defaults if table is empty.

### `POST /api/prompts`
Upsert prompt preset.

Body:
```json
{
  "kind": "DEV",
  "content": "You are the Dev agent..."
}
```

---

## Handoff

### `POST /api/handoff`
Generate dev handoff text bundle.

Body:
```json
{
  "projectId": "cuid_project",
  "ticketId": "FAIRLY-0001",
  "memoryLimit": 5
}
```

Response:
```json
{
  "handoff": "# Dev Handoff Bundle\n..."
}
```

---

## PowerShell examples

Create ticket:
```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/tickets" -ContentType "application/json" -Body (@{
  projectId = "cuid_project"
  title = "Fix auth redirect"
  type = "bug"
  priority = "P1"
  status = "ready"
  assignee = "codex-dev"
  estimate = 2
  specMarkdown = "..."
  acceptanceCriteria = "..."
  testPlan = "..."
  dependencies = @()
  labels = @("auth")
  position = 0
} | ConvertTo-Json -Depth 10)
```

Get next ready ticket:
```powershell
Invoke-RestMethod "http://localhost:3000/api/tickets/next?projectId=cuid_project&autoClaim=true&includeHandoff=true&memoryLimit=5"
```
