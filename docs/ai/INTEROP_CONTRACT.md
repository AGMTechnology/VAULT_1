# VAULT_0 <-> VAULT_1 Interop Contract

## Objective
Enable VAULT_1 desktop to consume and share core data from VAULT_0 without requiring immediate DB merge.

## Source API
Default base URL: `http://localhost:3000`

Required endpoints:
- `GET /api/projects`
- `GET /api/agents?projectId=<id>&includeInactive=true`
- `GET /api/tickets?projectId=<id>`
- `GET /api/memory?projectId=<id>&limit=<n>`

## Implemented bridge in VAULT_1
- Load VAULT_0 overview (projects + agents + tickets + memory samples).
- Import VAULT_0 agent into VAULT_1 project.
- Import VAULT_0 ticket into VAULT_1 project (with trace label `shared-from-vault0`).

## Identity and mapping rules
- Agents are matched by `agentId` for federation/import.
- Imported tickets preserve semantic fields but receive new project-local IDs in VAULT_1.
- Ticket provenance is recorded in ticket spec header (`VAULT_0 source ticket: ...`).

## Conflict policy (current)
- Agent import is upsert-by-`agentId` in target project.
- Ticket import always creates a new local ticket to avoid accidental overwrite.

## Next-step convergence options
- Runtime federation only.
- Scheduled one-way sync from VAULT_0 to VAULT_1.
- Bidirectional sync with conflict resolution policy.
- Full DB merge after dedicated feasibility validation.
