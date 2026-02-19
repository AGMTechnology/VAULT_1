You are a senior software architect and full-stack engineer.

I want you to build a LOCAL-FIRST web application that acts as a "Project Hub" to manage multiple software projects, generate developer tickets, and store working session memory.

This tool will orchestrate my workflow:
User → PM agent → Dev agent → session memory.

The system must be production-quality, deterministic, and Git-friendly.

You must design and implement the full architecture.

---

GOAL

Build a local web application that allows me to:

1. Manage multiple projects.
2. Generate developer-executable tickets.
3. Store session memory (append-only).
4. Generate developer handoff prompts.
5. Track progress across projects.
6. Operate fully locally (no cloud dependency).

This is a control panel for AI-driven development workflows.

---

TECH STACK (MANDATORY)

- React.js (App Router, TypeScript)
- SQLite database
- Prisma ORM
- Tailwind CSS
- Local filesystem storage for tickets and memory
- No external services required
- Must run with `npm run dev`

The app must be simple to run locally and easy to maintain.

---

CORE FEATURES

### 1. Multi-Project Management

Projects must include:
- id
- name
- description
- repo path
- figma link
- agents configuration
- conventions (AGENTS.md rules)

CRUD interface required.

---

### 2. Ticket System (Developer-Executable)

Each ticket must store:
- id (FAIRLY-0001 format)
- project id
- title
- type (feature / bug / chore)
- priority (P0/P1/P2)
- status (backlog / ready / in-progress / done)
- spec markdown
- acceptance criteria
- test plan
- dependencies
- labels

Tickets must:
- be editable
- be stored in DB
- optionally export to Markdown files
- support Kanban board view

---

### 3. Session Memory System (Append-Only)

Implement structured session memory:

- JSONL storage
- append-only
- per project
- fast retrieval

Session entry structure:

- session_id
- date
- task_summary
- successes
- failures
- user_preferences
- user_frustrations
- decisions_taken
- lessons_learned
- files_changed
- commands_run
- next_session_focus

Include:
- UI to log session
- UI to view/search memory
- memory rotation when file >300KB

---

### 4. PM → Dev Workflow

The app must generate:

- developer handoff prompts
- ticket context bundles
- project context
- recent memory context

Provide a button:

"Copy Dev Handoff"

It must assemble:
- selected ticket
- project rules
- recent memory
- constraints

---

### 5. Prompt Presets System

Allow storing reusable prompts:

- PM agent prompt
- Dev agent prompt
- Design agent prompt

Editable from UI.

---

### 6. Dashboard UI

Provide:

- project selector
- ticket Kanban board
- ticket detail panel
- session memory viewer
- prompt generator
- clean minimal UI

---

ARCHITECTURE REQUIREMENTS

- Modular clean architecture
- Domain separation (projects / tickets / memory / prompts)
- Repository pattern for persistence
- Type-safe models
- Clear folder structure
- Local-first design
- High performance
- Minimal dependencies

---

DATA STORAGE

Use both:

- SQLite → structured data
- Filesystem → tickets & memory JSONL

Propose directory structure.

---

DELIVERABLES

Return:

1. Full architecture design
2. Folder structure
3. Database schema
4. Prisma models
5. File storage strategy
6. Implementation plan
7. Step-by-step setup instructions
8. Initial code scaffolding
9. Example UI pages
10. Commands to run locally

Code must be copy-paste ready.

---

CONSTRAINTS

- Deterministic behavior
- No unnecessary complexity
- No cloud dependency
- No authentication required
- Local development only
- Clean maintainable code
- Optimized for developer workflow
- Only the assigned agent can start/execute a ticket; reassign first if needed
- Agents must fully embody their assigned role and personality in dialogue, ticket comments, and handoffs
- Personality-neutralizing wording is forbidden (for example: "persona applies to communication style only")

---

IMPORTANT

Do not ask questions.
Make reasonable architectural decisions.
Return a complete implementation plan and starting codebase.
