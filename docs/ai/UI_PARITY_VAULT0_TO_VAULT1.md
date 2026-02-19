# UI Parity Matrix: VAULT_0 -> VAULT_1

Objective: keep VAULT_1 desktop visually aligned with VAULT_0 board workflow while preserving desktop-only capabilities.

## Scope Covered

- Sidebar visual language: brand block, planning nav, sprint summary.
- Board shell: search, filters, refresh control, issue count, status columns, ticket cards.
- Ticket detail panel: status control, markdown export, handoff action, spec/AC/test plan blocks.
- Loading and empty states for API-fed board data.

## Parity Checklist

- [x] Board status columns match VAULT_0 workflow order and labels.
- [x] Search and filter controls align with VAULT_0 semantics (assignee/priority/type/status).
- [x] Refresh affordance and count badge visible in board toolbar.
- [x] Ticket card visual hierarchy: id, title, status pill, metadata.
- [x] Detail panel provides ticket status transition control and evidence actions.
- [x] Skeleton loading state before API payload is rendered.
- [x] Explicit empty state when no tickets exist for selected project.

## Desktop-Specific Features Preserved

- [x] Plug project from local path (`Plug local project`).
- [x] Plug project from git URL (`Clone and plug`).
- [x] Project archive/unarchive controls from VAULT_1 sidebar.

## Notes

- VAULT_1 board data is now sourced directly from VAULT_0 API endpoints.
- Legacy import bridge actions were removed from dashboard UI to avoid mixed data paths.
