export type TicketStatus =
  | "backlog"
  | "to-qualify"
  | "ready"
  | "in-progress"
  | "in-review"
  | "blocked"
  | "ask-boss"
  | "done";

export type TicketType = "story" | "feature" | "bug" | "task" | "chore";
export type TicketPriority = "P0" | "P1" | "P2" | "P3";

export type ProjectRecord = {
  id: string;
  name: string;
  description: string;
  repoPath: string;
  figmaLink: string;
  conventions: string;
  agentsConfiguration: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TicketRecord = {
  id: string;
  projectId: string;
  title: string;
  type: TicketType;
  priority: TicketPriority;
  status: TicketStatus;
  assignee: string;
  estimate: number;
  specMarkdown: string;
  acceptanceCriteria: string;
  testPlan: string;
  dependencies: string[];
  labels: string[];
  createdAt: string;
  updatedAt: string;
};

export type AgentRecord = {
  id: string;
  projectId: string;
  agentId: string;
  displayName: string;
  role: string;
  personality: string;
  skills: string[];
  rules: string[];
  defaultPrompt: string;
  avatarUrl: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MemoryEntry = {
  session_id: string;
  date: string;
  projectId: string;
  agentId: string;
  task_summary: string;
  successes: string[];
  failures: string[];
  user_preferences: string[];
  user_frustrations: string[];
  decisions_taken: string[];
  lessons_learned: string[];
  files_changed: string[];
  commands_run: string[];
  next_session_focus: string[];
};

export type ChatMessage = {
  id: string;
  projectId: string;
  agentId: string;
  author: string;
  content: string;
  createdAt: string;
};
