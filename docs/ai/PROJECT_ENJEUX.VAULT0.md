# Project Stakes

## Product goal

`Project Hub Local` is a local control panel for AI-assisted software delivery.

Main capabilities:
- manage multiple projects
- create and track executable tickets
- keep append-only session memory
- generate a dev handoff bundle

## Why it exists

The app is built to make the PM agent -> Dev agent workflow reliable and repeatable:
- strong project context
- structured tickets
- action traceability (audit log)
- explicit context transfer (memory + handoff)

## Non-negotiable constraints

- local-first (no cloud dependency)
- deterministic and git-friendly behavior
- JSON HTTP API
- no authentication (local environment)

## Core entities

- `Project`: project-level context and conventions
- `Ticket`: execution unit for development
- `Comment`: discussion per ticket
- `AuditLog`: ticket action history
- `PromptPreset`: PM/DEV/DESIGN reusable prompts
- `SessionMemoryEntry`: append-only memory per project

## Important invariants

1. A ticket must always be linked to a project (`projectId`).
2. Ticket IDs are generated on the server (`FAIRLY-xxxx`).
3. Memory is append-only and rotates when file size exceeds 300KB.
4. Ticket lifecycle actions are audited (create/update/status/delete/export/comment).
