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

## VAULT_0 Sources Imported

- Technical docs:
  - `README.md` (VAULT_0 root)
  - `tec_spec.md` (VAULT_0 root)
  - `AGENTS_PM.md` (VAULT_0 root)
  - `docs/ai/DESIGN_SYSTEM_VAULT0.md` (VAULT_0)
- Design system / page references:
  - https://www.figma.com/design/Iv7ECJGcMxmZnTtMq6A6UA/Untitled?node-id=2-2176&m=dev
  - https://www.figma.com/design/Iv7ECJGcMxmZnTtMq6A6UA/Untitled?node-id=5-4256&m=dev
  - https://www.figma.com/design/Iv7ECJGcMxmZnTtMq6A6UA/Untitled?node-id=5-4832&m=dev
  - https://www.figma.com/design/Iv7ECJGcMxmZnTtMq6A6UA/Untitled?node-id=5-5467&m=dev
  - https://www.figma.com/design/Iv7ECJGcMxmZnTtMq6A6UA/Untitled?node-id=5-6040&m=dev
