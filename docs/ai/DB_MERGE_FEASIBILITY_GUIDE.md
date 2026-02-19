# DB Merge Feasibility Guide (VAULT_0 + VAULT_1)

## Scope
Assess whether VAULT_0 and VAULT_1 databases can be merged safely while preserving traceability, workflows, and agent ownership.

## Mandatory audit dimensions
1. Schema parity and enum compatibility.
2. Identifier collision risk (projects, tickets, agents, comments, memory references).
3. Workflow semantics alignment.
4. Provenance and audit log continuity.
5. Rollback strategy and blast-radius control.

## Required outputs
- Target architecture recommendation (federation vs merge).
- Migration plan with phased checkpoints.
- Rollback plan per phase.
- Non-regression test matrix.

## Migration safety checklist
- Dry-run migration on snapshot data.
- Validation queries before/after migration.
- Deterministic re-run capability.
- Recovery time objective documented.

## Ticket linkage
In project VAULT_1, create and maintain a dedicated ticket for this audit/faisabilité stream.
