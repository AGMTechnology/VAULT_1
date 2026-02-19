import { ipcMain } from "electron";
import { z } from "zod";

import type { VaultCore } from "../src/main/core/vault-core";
import { IPC_CHANNELS } from "../src/shared/ipc";

const nonEmptyText = z.string().trim().min(1);

const projectCreateSchema = z.object({
  name: nonEmptyText,
  description: z.string().optional(),
  repoPath: z.string().optional(),
  figmaLink: z.string().optional(),
  conventions: z.string().optional(),
  agentsConfiguration: z.string().optional(),
});

const projectArchiveSchema = z.object({
  projectId: nonEmptyText,
  isArchived: z.boolean(),
});

const importPathSchema = z.object({
  name: nonEmptyText,
  repoPath: nonEmptyText,
  description: z.string().optional(),
});

const importGitSchema = z.object({
  name: nonEmptyText,
  repoUrl: nonEmptyText,
  destinationRoot: z.string().optional(),
  description: z.string().optional(),
});

const createTicketSchema = z.object({
  projectId: nonEmptyText,
  title: nonEmptyText,
  type: z.enum(["story", "feature", "bug", "task", "chore"]),
  priority: z.enum(["P0", "P1", "P2", "P3"]),
  status: z.enum(["backlog", "to-qualify", "ready", "in-progress", "in-review", "blocked", "ask-boss", "done"]),
  assignee: z.string().default(""),
  estimate: z.number().int().min(0).optional(),
  specMarkdown: z.string().optional(),
  acceptanceCriteria: z.string().optional(),
  testPlan: z.string().optional(),
  dependencies: z.array(z.string()).optional(),
  labels: z.array(z.string()).optional(),
});

const updateTicketStatusSchema = z.object({
  ticketId: nonEmptyText,
  status: z.enum(["backlog", "to-qualify", "ready", "in-progress", "in-review", "blocked", "ask-boss", "done"]),
});

const upsertAgentSchema = z.object({
  projectId: nonEmptyText,
  agentId: nonEmptyText,
  displayName: nonEmptyText,
  role: z.string().optional(),
  personality: z.string().optional(),
  skills: z.array(z.string()).optional(),
  rules: z.array(z.string()).optional(),
  defaultPrompt: z.string().optional(),
  avatarUrl: z.string().optional(),
  isActive: z.boolean().optional(),
});

const sendChatSchema = z.object({
  projectId: nonEmptyText,
  agentId: nonEmptyText,
  author: nonEmptyText,
  content: nonEmptyText,
});

const appendMemorySchema = z.object({
  projectId: nonEmptyText,
  input: z.object({
    agentId: nonEmptyText,
    task_summary: nonEmptyText,
    successes: z.array(z.string()).optional(),
    failures: z.array(z.string()).optional(),
    user_preferences: z.array(z.string()).optional(),
    user_frustrations: z.array(z.string()).optional(),
    decisions_taken: z.array(z.string()).optional(),
    lessons_learned: z.array(z.string()).optional(),
    files_changed: z.array(z.string()).optional(),
    commands_run: z.array(z.string()).optional(),
    next_session_focus: z.array(z.string()).optional(),
  }),
});

export function registerVaultIpc(core: VaultCore): void {
  ipcMain.handle(IPC_CHANNELS.HEALTH, async () => ({ ok: true }));

  ipcMain.handle(IPC_CHANNELS.PROJECTS_LIST, async (_event, includeArchived?: boolean) => {
    return core.listProjects(includeArchived !== false);
  });

  ipcMain.handle(IPC_CHANNELS.PROJECTS_CREATE, async (_event, payload: unknown) => {
    const input = projectCreateSchema.parse(payload);
    return core.createProject(input);
  });

  ipcMain.handle(IPC_CHANNELS.PROJECTS_ARCHIVE, async (_event, payload: unknown) => {
    const input = projectArchiveSchema.parse(payload);
    return core.setProjectArchiveState(input.projectId, input.isArchived);
  });

  ipcMain.handle(IPC_CHANNELS.PROJECTS_IMPORT_PATH, async (_event, payload: unknown) => {
    const input = importPathSchema.parse(payload);
    return core.importProjectFromPath(input);
  });

  ipcMain.handle(IPC_CHANNELS.PROJECTS_IMPORT_GIT, async (_event, payload: unknown) => {
    const input = importGitSchema.parse(payload);
    return core.importProjectFromGit(input);
  });

  ipcMain.handle(IPC_CHANNELS.TICKETS_LIST, async (_event, projectId: unknown) => {
    return core.listTickets(nonEmptyText.parse(projectId));
  });

  ipcMain.handle(IPC_CHANNELS.TICKETS_CREATE, async (_event, payload: unknown) => {
    const input = createTicketSchema.parse(payload);
    return core.createTicket(input);
  });

  ipcMain.handle(IPC_CHANNELS.TICKETS_UPDATE_STATUS, async (_event, payload: unknown) => {
    const input = updateTicketStatusSchema.parse(payload);
    return core.updateTicketStatus(input.ticketId, input.status);
  });

  ipcMain.handle(IPC_CHANNELS.TICKETS_EXPORT_MARKDOWN, async (_event, ticketId: unknown) => {
    const filePath = await core.exportTicketMarkdown(nonEmptyText.parse(ticketId));
    return { filePath };
  });

  ipcMain.handle(IPC_CHANNELS.AGENTS_LIST, async (_event, projectId: unknown, includeInactive?: boolean) => {
    return core.listAgents(nonEmptyText.parse(projectId), includeInactive !== false);
  });

  ipcMain.handle(IPC_CHANNELS.AGENTS_UPSERT, async (_event, payload: unknown) => {
    const input = upsertAgentSchema.parse(payload);
    return core.upsertAgent(input);
  });

  ipcMain.handle(IPC_CHANNELS.CHAT_LIST, async (_event, payload: unknown) => {
    const input = z.object({ projectId: nonEmptyText, agentId: z.string().optional() }).parse(payload);
    return core.listChatMessages(input);
  });

  ipcMain.handle(IPC_CHANNELS.CHAT_SEND, async (_event, payload: unknown) => {
    const input = sendChatSchema.parse(payload);
    return core.sendChatMessage(input);
  });

  ipcMain.handle(IPC_CHANNELS.MEMORY_LIST, async (_event, projectId: unknown, limit?: number) => {
    return core.listMemory(nonEmptyText.parse(projectId), typeof limit === "number" ? limit : 50);
  });

  ipcMain.handle(IPC_CHANNELS.MEMORY_APPEND, async (_event, payload: unknown) => {
    const input = appendMemorySchema.parse(payload);
    return core.appendMemory(input.projectId, input.input);
  });

  ipcMain.handle(IPC_CHANNELS.HANDOFF_GENERATE, async (_event, ticketId: unknown) => {
    const handoff = await core.generateHandoff(nonEmptyText.parse(ticketId));
    return { handoff };
  });
}
