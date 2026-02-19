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
} from "./contracts";

export type VaultApi = {
  health: () => Promise<{ ok: boolean }>;
  projects: {
    list: (includeArchived?: boolean) => Promise<ProjectRecord[]>;
    create: (input: {
      name: string;
      description?: string;
      repoPath?: string;
      figmaLink?: string;
      conventions?: string;
      agentsConfiguration?: string;
    }) => Promise<ProjectRecord>;
    archive: (projectId: string, isArchived: boolean) => Promise<ProjectRecord>;
    importFromPath: (input: { name: string; repoPath: string; description?: string }) => Promise<ProjectRecord>;
    importFromGit: (input: {
      name: string;
      repoUrl: string;
      destinationRoot?: string;
      description?: string;
    }) => Promise<ProjectRecord>;
  };
  tickets: {
    list: (projectId: string) => Promise<TicketRecord[]>;
    create: (input: {
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
    }) => Promise<TicketRecord>;
    updateStatus: (ticketId: string, status: TicketStatus) => Promise<TicketRecord>;
    exportMarkdown: (ticketId: string) => Promise<{ filePath: string }>;
  };
  agents: {
    list: (projectId: string, includeInactive?: boolean) => Promise<AgentRecord[]>;
    upsert: (input: {
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
    }) => Promise<AgentRecord>;
  };
  chat: {
    list: (input: { projectId: string; agentId?: string }) => Promise<ChatMessage[]>;
    send: (input: { projectId: string; agentId: string; author: string; content: string }) => Promise<ChatMessage>;
  };
  memory: {
    list: (projectId: string, limit?: number) => Promise<MemoryEntry[]>;
    append: (projectId: string, input: {
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
    }) => Promise<MemoryEntry>;
  };
  handoff: {
    generate: (ticketId: string) => Promise<{ handoff: string }>;
  };
  vault0: {
    overview: (baseUrl: string) => Promise<Vault0ProjectSnapshot[]>;
    importAgent: (input: {
      baseUrl: string;
      sourceProjectId: string;
      sourceAgentId: string;
      targetProjectId: string;
    }) => Promise<AgentRecord>;
    importTicket: (input: {
      baseUrl: string;
      sourceProjectId: string;
      sourceTicketId: string;
      targetProjectId: string;
    }) => Promise<TicketRecord>;
  };
};

export const IPC_CHANNELS = {
  HEALTH: "vault:health",
  PROJECTS_LIST: "vault:projects:list",
  PROJECTS_CREATE: "vault:projects:create",
  PROJECTS_ARCHIVE: "vault:projects:archive",
  PROJECTS_IMPORT_PATH: "vault:projects:import-path",
  PROJECTS_IMPORT_GIT: "vault:projects:import-git",
  TICKETS_LIST: "vault:tickets:list",
  TICKETS_CREATE: "vault:tickets:create",
  TICKETS_UPDATE_STATUS: "vault:tickets:update-status",
  TICKETS_EXPORT_MARKDOWN: "vault:tickets:export-markdown",
  AGENTS_LIST: "vault:agents:list",
  AGENTS_UPSERT: "vault:agents:upsert",
  CHAT_LIST: "vault:chat:list",
  CHAT_SEND: "vault:chat:send",
  MEMORY_LIST: "vault:memory:list",
  MEMORY_APPEND: "vault:memory:append",
  HANDOFF_GENERATE: "vault:handoff:generate",
  VAULT0_OVERVIEW: "vault:vault0:overview",
  VAULT0_IMPORT_AGENT: "vault:vault0:import-agent",
  VAULT0_IMPORT_TICKET: "vault:vault0:import-ticket",
} as const;
