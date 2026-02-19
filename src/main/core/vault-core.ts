import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import Database from "better-sqlite3";

import type {
  AgentRecord,
  ChatMessage,
  MemoryEntry,
  ProjectRecord,
  TicketPriority,
  TicketRecord,
  TicketStatus,
  TicketType,
  Vault0ProjectSnapshot,
} from "../../shared/contracts";

const execFileAsync = promisify(execFile);

type VaultCoreOptions = {
  dbPath: string;
  dataRoot: string;
};

type CreateProjectInput = {
  name: string;
  description?: string;
  repoPath?: string;
  figmaLink?: string;
  conventions?: string;
  agentsConfiguration?: string;
};

type ImportProjectFromPathInput = {
  name: string;
  repoPath: string;
  description?: string;
};

type ImportProjectFromGitInput = {
  name: string;
  repoUrl: string;
  destinationRoot?: string;
  description?: string;
};

type CreateTicketInput = {
  projectId: string;
  title: string;
  type: TicketType;
  priority: TicketPriority;
  status: TicketStatus;
  assignee: string;
  estimate?: number;
  specMarkdown?: string;
  acceptanceCriteria?: string;
  testPlan?: string;
  dependencies?: string[];
  labels?: string[];
};

type UpsertAgentInput = {
  projectId: string;
  agentId: string;
  displayName: string;
  role?: string;
  personality?: string;
  skills?: string[];
  rules?: string[];
  defaultPrompt?: string;
  avatarUrl?: string;
  isActive?: boolean;
};

type SendChatMessageInput = {
  projectId: string;
  agentId: string;
  author: string;
  content: string;
};

type ListChatMessagesInput = {
  projectId: string;
  agentId?: string;
};

type AppendMemoryInput = {
  agentId: string;
  task_summary: string;
  successes?: string[];
  failures?: string[];
  user_preferences?: string[];
  user_frustrations?: string[];
  decisions_taken?: string[];
  lessons_learned?: string[];
  files_changed?: string[];
  commands_run?: string[];
  next_session_focus?: string[];
};

type ImportAgentFromVault0Input = {
  baseUrl: string;
  sourceProjectId: string;
  sourceAgentId: string;
  targetProjectId: string;
};

type ImportTicketFromVault0Input = {
  baseUrl: string;
  sourceProjectId: string;
  sourceTicketId: string;
  targetProjectId: string;
};

function normalizeProjectSlug(projectName: string): string {
  const normalized = projectName
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");

  return normalized || "PROJECT";
}

function toIsoNow(): string {
  return new Date().toISOString();
}

function parseJsonArray(value: unknown): string[] {
  if (typeof value !== "string" || !value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((entry): entry is string => typeof entry === "string");
  } catch {
    return [];
  }
}

function stringifyArray(values: string[] | undefined): string {
  if (!values || values.length === 0) {
    return "[]";
  }
  const normalized = values.map((value) => value.trim()).filter(Boolean);
  return JSON.stringify(normalized);
}

function createDefaultAgentPrompt(displayName: string): string {
  return `${displayName}: execute tickets with strict TDD, local-first architecture, and deterministic delivery.`;
}

export class VaultCore {
  private readonly options: VaultCoreOptions;

  private db: Database.Database | null = null;

  constructor(options: VaultCoreOptions) {
    this.options = options;
  }

  async init(): Promise<void> {
    await fs.mkdir(path.dirname(this.options.dbPath), { recursive: true });
    await fs.mkdir(this.options.dataRoot, { recursive: true });

    this.db = new Database(this.options.dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        repoPath TEXT NOT NULL DEFAULT '',
        figmaLink TEXT NOT NULL DEFAULT '',
        conventions TEXT NOT NULL DEFAULT '',
        agentsConfiguration TEXT NOT NULL DEFAULT '',
        isArchived INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tickets (
        id TEXT PRIMARY KEY,
        projectId TEXT NOT NULL,
        sequence INTEGER NOT NULL,
        title TEXT NOT NULL,
        type TEXT NOT NULL,
        priority TEXT NOT NULL,
        status TEXT NOT NULL,
        assignee TEXT NOT NULL DEFAULT '',
        estimate INTEGER NOT NULL DEFAULT 0,
        specMarkdown TEXT NOT NULL DEFAULT '',
        acceptanceCriteria TEXT NOT NULL DEFAULT '',
        testPlan TEXT NOT NULL DEFAULT '',
        dependencies TEXT NOT NULL DEFAULT '[]',
        labels TEXT NOT NULL DEFAULT '[]',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY(projectId) REFERENCES projects(id) ON DELETE CASCADE,
        UNIQUE(projectId, sequence)
      );

      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        projectId TEXT NOT NULL,
        agentId TEXT NOT NULL,
        displayName TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT '',
        personality TEXT NOT NULL DEFAULT '',
        skills TEXT NOT NULL DEFAULT '[]',
        rules TEXT NOT NULL DEFAULT '[]',
        defaultPrompt TEXT NOT NULL DEFAULT '',
        avatarUrl TEXT NOT NULL DEFAULT '',
        isActive INTEGER NOT NULL DEFAULT 1,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY(projectId) REFERENCES projects(id) ON DELETE CASCADE,
        UNIQUE(projectId, agentId)
      );

      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        projectId TEXT NOT NULL,
        agentId TEXT NOT NULL,
        author TEXT NOT NULL,
        content TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        FOREIGN KEY(projectId) REFERENCES projects(id) ON DELETE CASCADE
      );
    `);
  }

  close(): void {
    this.db?.close();
    this.db = null;
  }

  private getDb(): Database.Database {
    if (!this.db) {
      throw new Error("VaultCore is not initialized");
    }
    return this.db;
  }

  private normalizeBaseUrl(baseUrl: string): string {
    return baseUrl.trim().replace(/\/+$/, "");
  }

  private async fetchVault0Json<T>(baseUrl: string, route: string): Promise<T> {
    const normalized = this.normalizeBaseUrl(baseUrl);
    const response = await fetch(`${normalized}${route}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`VAULT_0 API error ${response.status} on ${route}: ${body || response.statusText}`);
    }
    return (await response.json()) as T;
  }

  private projectMemoryFile(projectId: string): string {
    return path.join(this.options.dataRoot, "projects", projectId, "memory", "sessions.jsonl");
  }

  private projectTicketsDir(projectId: string): string {
    return path.join(this.options.dataRoot, "projects", projectId, "tickets");
  }

  private mapProject(row: Record<string, unknown>): ProjectRecord {
    return {
      id: String(row.id),
      name: String(row.name),
      description: String(row.description ?? ""),
      repoPath: String(row.repoPath ?? ""),
      figmaLink: String(row.figmaLink ?? ""),
      conventions: String(row.conventions ?? ""),
      agentsConfiguration: String(row.agentsConfiguration ?? ""),
      isArchived: Number(row.isArchived ?? 0) === 1,
      createdAt: String(row.createdAt),
      updatedAt: String(row.updatedAt),
    };
  }

  private mapTicket(row: Record<string, unknown>): TicketRecord {
    return {
      id: String(row.id),
      projectId: String(row.projectId),
      title: String(row.title),
      type: String(row.type) as TicketType,
      priority: String(row.priority) as TicketPriority,
      status: String(row.status) as TicketStatus,
      assignee: String(row.assignee ?? ""),
      estimate: Number(row.estimate ?? 0),
      specMarkdown: String(row.specMarkdown ?? ""),
      acceptanceCriteria: String(row.acceptanceCriteria ?? ""),
      testPlan: String(row.testPlan ?? ""),
      dependencies: parseJsonArray(row.dependencies),
      labels: parseJsonArray(row.labels),
      createdAt: String(row.createdAt),
      updatedAt: String(row.updatedAt),
    };
  }

  private mapAgent(row: Record<string, unknown>): AgentRecord {
    return {
      id: String(row.id),
      projectId: String(row.projectId),
      agentId: String(row.agentId),
      displayName: String(row.displayName),
      role: String(row.role ?? ""),
      personality: String(row.personality ?? ""),
      skills: parseJsonArray(row.skills),
      rules: parseJsonArray(row.rules),
      defaultPrompt: String(row.defaultPrompt ?? ""),
      avatarUrl: String(row.avatarUrl ?? ""),
      isActive: Number(row.isActive ?? 1) === 1,
      createdAt: String(row.createdAt),
      updatedAt: String(row.updatedAt),
    };
  }

  async createProject(input: CreateProjectInput): Promise<ProjectRecord> {
    const db = this.getDb();
    const id = randomUUID();
    const now = toIsoNow();

    db.prepare(
      `
        INSERT INTO projects (
          id, name, description, repoPath, figmaLink, conventions, agentsConfiguration, isArchived, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
      `,
    ).run(
      id,
      input.name.trim(),
      input.description?.trim() ?? "",
      input.repoPath?.trim() ?? "",
      input.figmaLink?.trim() ?? "",
      input.conventions?.trim() ?? "",
      input.agentsConfiguration?.trim() ?? "",
      now,
      now,
    );

    await fs.mkdir(path.dirname(this.projectMemoryFile(id)), { recursive: true });
    await this.seedDefaultAgents(id);

    const row = db.prepare(`SELECT * FROM projects WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
    if (!row) {
      throw new Error("Failed to create project");
    }

    return this.mapProject(row);
  }

  async seedDefaultAgents(projectId: string): Promise<void> {
    await this.upsertAgent({
      projectId,
      agentId: "codex-dev",
      displayName: "Codex Dev",
      role: "developer",
      personality: "direct, pragmatic, rigorous",
      skills: ["typescript", "testing", "debugging", "delivery"],
      rules: [
        "Read project docs before coding.",
        "Follow strict TDD.",
        "Keep scope aligned with assigned ticket.",
      ],
      defaultPrompt: createDefaultAgentPrompt("Codex Dev"),
    });

    await this.upsertAgent({
      projectId,
      agentId: "agent-pm",
      displayName: "Agent PM",
      role: "project manager",
      personality: "structured, execution-focused",
      skills: ["ticketing", "prioritization", "spec-writing"],
      rules: ["Write executable tickets.", "Always include acceptance criteria and test plan."],
      defaultPrompt: createDefaultAgentPrompt("Agent PM"),
    });
  }

  async listProjects(includeArchived = true): Promise<ProjectRecord[]> {
    const db = this.getDb();
    const rows = includeArchived
      ? (db.prepare(`SELECT * FROM projects ORDER BY updatedAt DESC`).all() as Record<string, unknown>[])
      : (db
          .prepare(`SELECT * FROM projects WHERE isArchived = 0 ORDER BY updatedAt DESC`)
          .all() as Record<string, unknown>[]);
    return rows.map((row) => this.mapProject(row));
  }

  async getProjectById(projectId: string): Promise<ProjectRecord | null> {
    const db = this.getDb();
    const row = db.prepare(`SELECT * FROM projects WHERE id = ?`).get(projectId) as Record<string, unknown> | undefined;
    return row ? this.mapProject(row) : null;
  }

  async setProjectArchiveState(projectId: string, isArchived: boolean): Promise<ProjectRecord> {
    const db = this.getDb();
    const now = toIsoNow();
    const result = db
      .prepare(`UPDATE projects SET isArchived = ?, updatedAt = ? WHERE id = ?`)
      .run(isArchived ? 1 : 0, now, projectId);
    if (result.changes === 0) {
      throw new Error("Project not found");
    }
    const row = db.prepare(`SELECT * FROM projects WHERE id = ?`).get(projectId) as Record<string, unknown>;
    return this.mapProject(row);
  }

  async importProjectFromPath(input: ImportProjectFromPathInput): Promise<ProjectRecord> {
    const resolvedPath = path.resolve(input.repoPath);

    let stats;
    try {
      stats = await fs.stat(resolvedPath);
    } catch {
      throw new Error("Project path does not exist");
    }
    if (!stats.isDirectory()) {
      throw new Error("Project path is not a directory");
    }

    try {
      const gitStats = await fs.stat(path.join(resolvedPath, ".git"));
      if (!gitStats.isDirectory()) {
        throw new Error("Path is not a git repository");
      }
    } catch {
      throw new Error("Path is not a git repository");
    }

    return this.createProject({
      name: input.name,
      description: input.description ?? "",
      repoPath: resolvedPath,
    });
  }

  async importProjectFromGit(input: ImportProjectFromGitInput): Promise<ProjectRecord> {
    const destinationRoot = path.resolve(input.destinationRoot ?? path.join(this.options.dataRoot, "repos"));
    await fs.mkdir(destinationRoot, { recursive: true });

    const repoName = input.repoUrl
      .split("/")
      .filter(Boolean)
      .at(-1)
      ?.replace(/\.git$/i, "")
      .replace(/[^a-zA-Z0-9-_]+/g, "-")
      .replace(/^-+|-+$/g, "") || "repository";

    const target = path.join(destinationRoot, repoName);

    try {
      await fs.stat(target);
      throw new Error("Target directory already exists");
    } catch {
      // Directory does not exist, continue.
    }

    try {
      await execFileAsync("git", ["clone", input.repoUrl, target]);
    } catch (error) {
      throw new Error(
        `Git clone failed: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }

    return this.importProjectFromPath({
      name: input.name,
      repoPath: target,
      description: input.description,
    });
  }

  async createTicket(input: CreateTicketInput): Promise<TicketRecord> {
    const db = this.getDb();
    const project = await this.getProjectById(input.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    const sequenceRow = db
      .prepare(`SELECT COALESCE(MAX(sequence), 0) AS maxSeq FROM tickets WHERE projectId = ?`)
      .get(input.projectId) as { maxSeq: number };
    const nextSequence = Number(sequenceRow.maxSeq) + 1;
    const ticketId = `${normalizeProjectSlug(project.name)}-${String(nextSequence).padStart(3, "0")}`;
    const now = toIsoNow();

    db.prepare(
      `
        INSERT INTO tickets (
          id, projectId, sequence, title, type, priority, status, assignee, estimate, specMarkdown,
          acceptanceCriteria, testPlan, dependencies, labels, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    ).run(
      ticketId,
      input.projectId,
      nextSequence,
      input.title.trim(),
      input.type,
      input.priority,
      input.status,
      input.assignee.trim(),
      input.estimate ?? 0,
      input.specMarkdown ?? "",
      input.acceptanceCriteria ?? "",
      input.testPlan ?? "",
      stringifyArray(input.dependencies),
      stringifyArray(input.labels),
      now,
      now,
    );

    const row = db.prepare(`SELECT * FROM tickets WHERE id = ?`).get(ticketId) as Record<string, unknown>;
    return this.mapTicket(row);
  }

  async listTickets(projectId: string): Promise<TicketRecord[]> {
    const db = this.getDb();
    const rows = db
      .prepare(`SELECT * FROM tickets WHERE projectId = ? ORDER BY updatedAt DESC, id DESC`)
      .all(projectId) as Record<string, unknown>[];
    return rows.map((row) => this.mapTicket(row));
  }

  async updateTicketStatus(ticketId: string, status: TicketStatus): Promise<TicketRecord> {
    const db = this.getDb();
    const now = toIsoNow();
    const result = db.prepare(`UPDATE tickets SET status = ?, updatedAt = ? WHERE id = ?`).run(status, now, ticketId);
    if (result.changes === 0) {
      throw new Error("Ticket not found");
    }
    const row = db.prepare(`SELECT * FROM tickets WHERE id = ?`).get(ticketId) as Record<string, unknown>;
    return this.mapTicket(row);
  }

  async upsertAgent(input: UpsertAgentInput): Promise<AgentRecord> {
    const db = this.getDb();
    const now = toIsoNow();

    const existing = db
      .prepare(`SELECT id FROM agents WHERE projectId = ? AND agentId = ?`)
      .get(input.projectId, input.agentId.trim()) as { id: string } | undefined;

    if (existing) {
      db.prepare(
        `
          UPDATE agents
          SET displayName = ?, role = ?, personality = ?, skills = ?, rules = ?, defaultPrompt = ?, avatarUrl = ?, isActive = ?, updatedAt = ?
          WHERE id = ?
        `,
      ).run(
        input.displayName.trim(),
        input.role ?? "",
        input.personality ?? "",
        stringifyArray(input.skills),
        stringifyArray(input.rules),
        input.defaultPrompt ?? "",
        input.avatarUrl ?? "",
        input.isActive === false ? 0 : 1,
        now,
        existing.id,
      );

      const row = db.prepare(`SELECT * FROM agents WHERE id = ?`).get(existing.id) as Record<string, unknown>;
      return this.mapAgent(row);
    }

    const id = randomUUID();
    db.prepare(
      `
        INSERT INTO agents (
          id, projectId, agentId, displayName, role, personality, skills, rules, defaultPrompt, avatarUrl, isActive, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    ).run(
      id,
      input.projectId,
      input.agentId.trim(),
      input.displayName.trim(),
      input.role ?? "",
      input.personality ?? "",
      stringifyArray(input.skills),
      stringifyArray(input.rules),
      input.defaultPrompt ?? "",
      input.avatarUrl ?? "",
      input.isActive === false ? 0 : 1,
      now,
      now,
    );

    const row = db.prepare(`SELECT * FROM agents WHERE id = ?`).get(id) as Record<string, unknown>;
    return this.mapAgent(row);
  }

  async listAgents(projectId: string, includeInactive = true): Promise<AgentRecord[]> {
    const db = this.getDb();
    const rows = includeInactive
      ? (db
          .prepare(`SELECT * FROM agents WHERE projectId = ? ORDER BY isActive DESC, displayName ASC`)
          .all(projectId) as Record<string, unknown>[])
      : (db
          .prepare(`SELECT * FROM agents WHERE projectId = ? AND isActive = 1 ORDER BY displayName ASC`)
          .all(projectId) as Record<string, unknown>[]);

    return rows.map((row) => this.mapAgent(row));
  }

  private async listVault0Projects(baseUrl: string): Promise<ProjectRecord[]> {
    const payload = await this.fetchVault0Json<{ projects: ProjectRecord[] }>(baseUrl, "/api/projects");
    return payload.projects ?? [];
  }

  private async listVault0Agents(baseUrl: string, projectId: string): Promise<AgentRecord[]> {
    const payload = await this.fetchVault0Json<{ agents: AgentRecord[] }>(
      baseUrl,
      `/api/agents?projectId=${encodeURIComponent(projectId)}&includeInactive=true`,
    );
    return payload.agents ?? [];
  }

  private async listVault0Tickets(baseUrl: string, projectId: string): Promise<TicketRecord[]> {
    const payload = await this.fetchVault0Json<{ tickets: TicketRecord[] }>(
      baseUrl,
      `/api/tickets?projectId=${encodeURIComponent(projectId)}`,
    );
    return payload.tickets ?? [];
  }

  private async listVault0Memory(baseUrl: string, projectId: string, limit = 20): Promise<MemoryEntry[]> {
    const payload = await this.fetchVault0Json<{ entries: MemoryEntry[] }>(
      baseUrl,
      `/api/memory?projectId=${encodeURIComponent(projectId)}&limit=${limit}`,
    );
    return payload.entries ?? [];
  }

  async getVault0Overview(baseUrl: string): Promise<Vault0ProjectSnapshot[]> {
    const projects = await this.listVault0Projects(baseUrl);
    return Promise.all(
      projects.map(async (project) => {
        const [agents, tickets, memory] = await Promise.all([
          this.listVault0Agents(baseUrl, project.id),
          this.listVault0Tickets(baseUrl, project.id),
          this.listVault0Memory(baseUrl, project.id, 20),
        ]);
        return {
          project,
          agents,
          tickets,
          memory,
        };
      }),
    );
  }

  async importAgentFromVault0(input: ImportAgentFromVault0Input): Promise<AgentRecord> {
    const targetProject = await this.getProjectById(input.targetProjectId);
    if (!targetProject) {
      throw new Error("Target project not found");
    }

    const agents = await this.listVault0Agents(input.baseUrl, input.sourceProjectId);
    const sourceAgent = agents.find(
      (agent) => agent.id === input.sourceAgentId || agent.agentId === input.sourceAgentId,
    );
    if (!sourceAgent) {
      throw new Error("Source agent not found in VAULT_0");
    }

    return this.upsertAgent({
      projectId: input.targetProjectId,
      agentId: sourceAgent.agentId,
      displayName: sourceAgent.displayName,
      role: sourceAgent.role,
      personality: sourceAgent.personality,
      skills: sourceAgent.skills,
      rules: sourceAgent.rules,
      defaultPrompt: sourceAgent.defaultPrompt,
      avatarUrl: sourceAgent.avatarUrl,
      isActive: sourceAgent.isActive,
    });
  }

  async importTicketFromVault0(input: ImportTicketFromVault0Input): Promise<TicketRecord> {
    const targetProject = await this.getProjectById(input.targetProjectId);
    if (!targetProject) {
      throw new Error("Target project not found");
    }

    const tickets = await this.listVault0Tickets(input.baseUrl, input.sourceProjectId);
    const sourceTicket = tickets.find((ticket) => ticket.id === input.sourceTicketId);
    if (!sourceTicket) {
      throw new Error("Source ticket not found in VAULT_0");
    }

    const mergedLabels = Array.from(new Set([...(sourceTicket.labels ?? []), "shared-from-vault0"]));
    const prefixedSpec = [
      `VAULT_0 source ticket: ${sourceTicket.id} (project ${sourceTicket.projectId})`,
      "",
      sourceTicket.specMarkdown ?? "",
    ].join("\n");

    return this.createTicket({
      projectId: input.targetProjectId,
      title: sourceTicket.title,
      type: sourceTicket.type,
      priority: sourceTicket.priority,
      status: sourceTicket.status,
      assignee: sourceTicket.assignee,
      estimate: sourceTicket.estimate,
      specMarkdown: prefixedSpec,
      acceptanceCriteria: sourceTicket.acceptanceCriteria,
      testPlan: sourceTicket.testPlan,
      dependencies: sourceTicket.dependencies,
      labels: mergedLabels,
    });
  }

  async sendChatMessage(input: SendChatMessageInput): Promise<ChatMessage> {
    const db = this.getDb();
    const project = await this.getProjectById(input.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    const id = randomUUID();
    const createdAt = toIsoNow();

    db.prepare(
      `
        INSERT INTO chat_messages (id, projectId, agentId, author, content, createdAt)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
    ).run(id, input.projectId, input.agentId, input.author, input.content.trim(), createdAt);

    return {
      id,
      projectId: input.projectId,
      agentId: input.agentId,
      author: input.author,
      content: input.content.trim(),
      createdAt,
    };
  }

  async listChatMessages(input: ListChatMessagesInput): Promise<ChatMessage[]> {
    const db = this.getDb();
    const rows = input.agentId
      ? (db
          .prepare(
            `SELECT id, projectId, agentId, author, content, createdAt
             FROM chat_messages
             WHERE projectId = ? AND agentId = ?
             ORDER BY createdAt ASC`,
          )
          .all(input.projectId, input.agentId) as Array<Record<string, unknown>>)
      : (db
          .prepare(
            `SELECT id, projectId, agentId, author, content, createdAt
             FROM chat_messages
             WHERE projectId = ?
             ORDER BY createdAt ASC`,
          )
          .all(input.projectId) as Array<Record<string, unknown>>);

    return rows.map((row) => ({
      id: String(row.id),
      projectId: String(row.projectId),
      agentId: String(row.agentId),
      author: String(row.author),
      content: String(row.content),
      createdAt: String(row.createdAt),
    }));
  }

  async appendMemory(projectId: string, input: AppendMemoryInput): Promise<MemoryEntry> {
    const project = await this.getProjectById(projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    const entry: MemoryEntry = {
      session_id: randomUUID(),
      date: toIsoNow(),
      projectId,
      agentId: input.agentId,
      task_summary: input.task_summary.trim(),
      successes: input.successes ?? [],
      failures: input.failures ?? [],
      user_preferences: input.user_preferences ?? [],
      user_frustrations: input.user_frustrations ?? [],
      decisions_taken: input.decisions_taken ?? [],
      lessons_learned: input.lessons_learned ?? [],
      files_changed: input.files_changed ?? [],
      commands_run: input.commands_run ?? [],
      next_session_focus: input.next_session_focus ?? [],
    };

    const memoryFile = this.projectMemoryFile(projectId);
    await fs.mkdir(path.dirname(memoryFile), { recursive: true });
    await fs.appendFile(memoryFile, `${JSON.stringify(entry)}\n`, "utf8");

    return entry;
  }

  async listMemory(projectId: string, limit = 50): Promise<MemoryEntry[]> {
    const memoryFile = this.projectMemoryFile(projectId);
    try {
      const raw = await fs.readFile(memoryFile, "utf8");
      const parsed = raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          try {
            return JSON.parse(line) as MemoryEntry;
          } catch {
            return null;
          }
        })
        .filter((entry): entry is MemoryEntry => entry !== null);

      return parsed.slice(-limit);
    } catch {
      return [];
    }
  }

  async generateHandoff(ticketId: string): Promise<string> {
    const db = this.getDb();
    const row = db.prepare(`SELECT * FROM tickets WHERE id = ?`).get(ticketId) as Record<string, unknown> | undefined;
    if (!row) {
      throw new Error("Ticket not found");
    }
    const ticket = this.mapTicket(row);
    const project = await this.getProjectById(ticket.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    const memories = await this.listMemory(project.id, 3);

    const memorySection =
      memories.length === 0
        ? "- none"
        : memories.map((entry) => `- ${entry.date} | ${entry.agentId}: ${entry.task_summary}`).join("\n");

    return [
      `[PROJECT] ${project.name} (${project.id})`,
      project.conventions ? `[RULES]\n${project.conventions}` : "[RULES]\nNo explicit conventions.",
      `[TICKET] ${ticket.id} - ${ticket.title}`,
      `Type=${ticket.type} Priority=${ticket.priority} Status=${ticket.status} Assignee=${ticket.assignee}`,
      "[SPEC]",
      ticket.specMarkdown || "",
      "[ACCEPTANCE_CRITERIA]",
      ticket.acceptanceCriteria || "",
      "[TEST_PLAN]",
      ticket.testPlan || "",
      "[RECENT_MEMORY]",
      memorySection,
      "[DELIVERY_CONSTRAINTS]",
      "- Follow TDD: failing tests first, then implementation, keep tests green.",
      "- Keep changes scoped to active ticket.",
      "- Document blockers with explicit evidence.",
    ].join("\n\n");
  }

  async exportTicketMarkdown(ticketId: string): Promise<string> {
    const db = this.getDb();
    const row = db.prepare(`SELECT * FROM tickets WHERE id = ?`).get(ticketId) as Record<string, unknown> | undefined;
    if (!row) {
      throw new Error("Ticket not found");
    }
    const ticket = this.mapTicket(row);
    const project = await this.getProjectById(ticket.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    const lines = [
      "---",
      `ticketId: ${ticket.id}`,
      `projectId: ${ticket.projectId}`,
      `status: ${ticket.status}`,
      `priority: ${ticket.priority}`,
      `type: ${ticket.type}`,
      `assignee: ${ticket.assignee}`,
      `updatedAt: ${ticket.updatedAt}`,
      "---",
      "",
      `# ${ticket.id} - ${ticket.title}`,
      "",
      "## Specification",
      ticket.specMarkdown,
      "",
      "## Acceptance Criteria",
      ticket.acceptanceCriteria,
      "",
      "## Test Plan",
      ticket.testPlan,
    ];

    const ticketsDir = this.projectTicketsDir(project.id);
    await fs.mkdir(ticketsDir, { recursive: true });
    const filePath = path.join(ticketsDir, `${ticket.id}.md`);
    await fs.writeFile(filePath, lines.join("\n"), "utf8");
    return filePath;
  }
}
