# Agent Playbook

This file describes practical workflows for PM and Dev agents.

## Preconditions

1. Start app: `npm run dev`
2. API reachable at `http://localhost:3000`

## PM Agent workflow

### 1) List projects
```powershell
Invoke-RestMethod http://localhost:3000/api/projects
```

### 2) Create ticket (recommended via script)
```powershell
.\scripts\agent-pm-create-ticket.ps1 `
  -ProjectId "<PROJECT_ID>" `
  -Title "Implement onboarding flow" `
  -Type story `
  -Priority P1 `
  -Status ready `
  -Assignee "codex-dev" `
  -Estimate 5 `
  -SpecMarkdown "..." `
  -AcceptanceCriteria "..." `
  -TestPlan "..." `
  -Labels "onboarding","mobile"
```

## Dev Agent workflow

### Get next ready ticket (recommended via script)
```powershell
.\scripts\agent-dev-check-next-ticket.ps1 `
  -ProjectId "<PROJECT_ID>" `
  -AgentId "codex-dev" `
  -AutoClaim `
  -IncludeHandoff $true `
  -HandoffPath ".codex-handoff.md"
```

What it does:
- calls `/api/tickets/next`
- picks highest priority `ready` ticket
- enforces that only the assigned agent can claim/start the ticket
- must set ticket to `in-progress` before coding (execution constraint)
- optionally writes handoff file
- when auto-claiming, the script fetches required project docs from `/api/projects/{id}/docs` and sends review proof

### Mandatory execution policy (TDD + git)

1. Write tests first (TDD) before production code.
2. Implement code to make tests pass.
3. Commit with ticket id in commit subject (example: `VAULT-0-010: enforce TDD workflow`).
4. Push commit to upstream branch.
5. Only then move ticket to `in-review`.
6. For bug/regression/workflow tickets, add a post-mortem in ticket comments and project memory.
7. Stay fully in assigned role/personality in all delivery communication (dialogue, comments, handoff).
8. Do not use personality-neutralizing wording (for example: "persona applies to communication style only").

Before starting implementation, review required docs:
```powershell
Invoke-RestMethod "http://localhost:3000/api/projects/<PROJECT_ID>/docs"
```

### Complete ticket (enforced script)
```powershell
.\scripts\agent-dev-complete-ticket.ps1 `
  -TicketId "<TICKET_ID>" `
  -RepoPath "<REPO_PATH>" `
  -TestEvidence "Added failing tests first, then implementation, all tests pass"
```

The completion script enforces:
- `npm run test` in the target repo
- `npm test` cannot be a lint/typecheck-only command
- `TestEvidence` must include TDD flow evidence (`red/fail` then `green/pass`)
- clean git working tree
- latest commit subject references only `<TICKET_ID>`
- at least one test file exists in git
- latest commit includes test file changes
- latest commit is pushed to upstream
- post-mortem evidence exists for bug/regression/workflow tickets
- writes `[DEV_DONE]` evidence comment, then transitions to `in-review`
- bypass flags are disabled (`-SkipQualityChecks` and `-SkipGitValidation` are rejected)

### Add post-mortem evidence
```powershell
.\scripts\agent-dev-postmortem.ps1 `
  -TicketId "<TICKET_ID>" `
  -RootCause "Root cause summary" `
  -FixSummary "Fix applied summary" `
  -ValidationEvidence "How the fix was validated"
```

## Common actions

Update ticket status:
```powershell
Invoke-RestMethod -Method Put -Uri "http://localhost:3000/api/tickets/<TICKET_ID>" -ContentType "application/json" -Body '{"status":"in-review"}'
```

Note:
- The API refuses `in-review` when no `[DEV_DONE]` evidence comment exists on the ticket.

Add comment:
```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/tickets/<TICKET_ID>/comments" -ContentType "application/json" -Body '{"author":"codex-dev","bodyMd":"PR ready"}'
```

Export markdown:
```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/tickets/<TICKET_ID>/export"
```

## Guardrails for AI agents

1. Always fetch projects first and use a real `projectId`.
2. Never assume ticket enums; use documented values.
3. On `400 Validation failed`, fix payload and retry.
4. On `404`, refresh context (project/ticket may be missing).
5. Do not bypass TDD/commit/push checks unless explicitly requested by the boss.
6. Skip flags are disabled in `agent-dev-complete-ticket.ps1`; constraints are mandatory by default.
7. If actor and assignee do not match, reassign before execution.
