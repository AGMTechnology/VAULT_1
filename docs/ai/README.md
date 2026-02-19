# VAULT_1 AI Docs

This repository contains imported VAULT_0 AI contracts and desktop-adapted documentation.

## Imported from VAULT_0 (baseline)
- `docs/ai/AGENTS_PM.VAULT0.md`
- `docs/ai/AGENT_PLAYBOOK.VAULT0.md`
- `docs/ai/API_REFERENCE.VAULT0.md`
- `docs/ai/ARCHITECTURE.VAULT0.md`
- `docs/ai/PROJECT_ENJEUX.VAULT0.md`
- `docs/ai/openapi.vault0.yaml`

## VAULT_1-specific contracts
- `docs/ai/INTEROP_CONTRACT.md`
- `docs/ai/DB_MERGE_FEASIBILITY_GUIDE.md`

## Rules for VAULT_1
- VAULT_1 is a standalone desktop-first repo.
- VAULT_1 must be able to fetch VAULT_0 data over API.
- Agent and ticket sharing is handled through explicit import/federation operations.
- Any future DB merge must be preceded by audit and rollback-ready migration planning.
