import { useEffect, useMemo, useState } from "react";

import type {
  AgentRecord,
  ChatMessage,
  MemoryEntry,
  ProjectRecord,
  TicketRecord,
  TicketStatus,
} from "@shared/contracts";
import type { VaultApi } from "@shared/ipc";

const STATUSES: TicketStatus[] = [
  "to-qualify",
  "backlog",
  "ready",
  "in-progress",
  "in-review",
  "blocked",
  "ask-boss",
  "done",
];

const BOARD_COLUMNS: TicketStatus[] = [
  "to-qualify",
  "ready",
  "in-progress",
  "in-review",
  "blocked",
  "ask-boss",
  "done",
];

type PlanningView = "board" | "list" | "backlog";

const VIEW_LABELS: Record<PlanningView, string> = {
  board: "Board",
  list: "List",
  backlog: "Backlog",
};

const STATUS_LABELS: Record<TicketStatus, string> = {
  "to-qualify": "To Qualify",
  backlog: "Backlog",
  ready: "Ready",
  "in-progress": "In Progress",
  "in-review": "In Review",
  blocked: "Blocked",
  "ask-boss": "Ask Boss",
  done: "Done",
};

type TicketDraft = {
  title: string;
  type: "feature" | "bug" | "task" | "story" | "chore";
  priority: "P0" | "P1" | "P2" | "P3";
  status: TicketStatus;
  assignee: string;
  specMarkdown: string;
  acceptanceCriteria: string;
  testPlan: string;
};

const EMPTY_TICKET_DRAFT: TicketDraft = {
  title: "",
  type: "feature",
  priority: "P1",
  status: "to-qualify",
  assignee: "",
  specMarkdown: "",
  acceptanceCriteria: "",
  testPlan: "",
};

function vaultApi(): VaultApi {
  const api = (window as Window & { vault?: VaultApi }).vault;
  if (!api) {
    throw new Error(
      "Desktop bridge unavailable (window.vault). Restart VAULT_1 and ensure preload is active.",
    );
  }
  return api;
}

export function App(): React.JSX.Element {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [tickets, setTickets] = useState<TicketRecord[]>([]);
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState("");
  const [chatAgentId, setChatAgentId] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [memoryEntries, setMemoryEntries] = useState<MemoryEntry[]>([]);
  const [handoffText, setHandoffText] = useState("");
  const [vault0BaseUrl, setVault0BaseUrl] = useState("http://localhost:3000");
  const [vault0Projects, setVault0Projects] = useState<ProjectRecord[]>([]);
  const [vault0SourceProjectId, setVault0SourceProjectId] = useState("");

  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");
  const [importPathName, setImportPathName] = useState("");
  const [importPathValue, setImportPathValue] = useState("");
  const [importGitName, setImportGitName] = useState("");
  const [importGitUrl, setImportGitUrl] = useState("");

  const [ticketDraft, setTicketDraft] = useState<TicketDraft>(EMPTY_TICKET_DRAFT);
  const [memorySummary, setMemorySummary] = useState("");
  const [chatText, setChatText] = useState("");
  const [showCreateTicketModal, setShowCreateTicketModal] = useState(false);
  const [showTicketDetailModal, setShowTicketDetailModal] = useState(false);
  const [view, setView] = useState<PlanningView>("backlog");
  const [ticketSearch, setTicketSearch] = useState("");
  const [filterAssignee, setFilterAssignee] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [lastRefreshedAt, setLastRefreshedAt] = useState("");

  const [loading, setLoading] = useState(false);
  const [boardLoading, setBoardLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedTicketId) ?? null,
    [tickets, selectedTicketId],
  );

  const selectedVault0Project = useMemo(
    () => vault0Projects.find((project) => project.id === vault0SourceProjectId) ?? null,
    [vault0Projects, vault0SourceProjectId],
  );

  const filteredTickets = useMemo(() => {
    const query = ticketSearch.trim().toLowerCase();
    const assigneeFilter = filterAssignee.trim().toLowerCase();
    if (!query) {
      return tickets.filter((ticket) => {
        if (filterStatus && ticket.status !== filterStatus) return false;
        if (filterPriority && ticket.priority !== filterPriority) return false;
        if (filterType && ticket.type !== filterType) return false;
        if (assigneeFilter && !ticket.assignee.toLowerCase().includes(assigneeFilter)) return false;
        return true;
      });
    }
    return tickets.filter((ticket) => {
      if (filterStatus && ticket.status !== filterStatus) return false;
      if (filterPriority && ticket.priority !== filterPriority) return false;
      if (filterType && ticket.type !== filterType) return false;
      if (assigneeFilter && !ticket.assignee.toLowerCase().includes(assigneeFilter)) return false;

      const haystack = `${ticket.id} ${ticket.title} ${ticket.assignee} ${ticket.type} ${ticket.priority}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [filterAssignee, filterPriority, filterStatus, filterType, ticketSearch, tickets]);

  const groupedTickets = useMemo(() => {
    const groups = new Map<TicketStatus, TicketRecord[]>();
    STATUSES.forEach((status) => groups.set(status, []));
    filteredTickets.forEach((ticket) => {
      groups.get(ticket.status)?.push(ticket);
    });
    return groups;
  }, [filteredTickets]);

  const ticketAssignees = useMemo(() => {
    return Array.from(new Set(tickets.map((ticket) => ticket.assignee.trim()).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b),
    );
  }, [tickets]);

  const workflowCounts = useMemo(() => {
    const toDo = tickets.filter((ticket) =>
      ticket.status === "to-qualify" || ticket.status === "backlog" || ticket.status === "ready",
    ).length;
    return {
      toDo,
      inProgress: tickets.filter((ticket) => ticket.status === "in-progress").length,
      inReview: tickets.filter((ticket) => ticket.status === "in-review").length,
      done: tickets.filter((ticket) => ticket.status === "done").length,
    };
  }, [tickets]);

  async function refreshProjects(): Promise<ProjectRecord[]> {
    const rows = await vaultApi().projects.list(true);
    setProjects(rows);
    setSelectedProjectId((current) => {
      if (current && rows.some((project) => project.id === current)) {
        return current;
      }
      return rows.find((project) => !project.isArchived)?.id ?? rows[0]?.id ?? "";
    });
    return rows;
  }

  async function refreshChat(projectId: string, agentId: string): Promise<void> {
    if (!projectId) {
      setChatMessages([]);
      return;
    }

    const rows = await vaultApi().chat.list({ projectId, agentId: agentId || undefined });
    setChatMessages(rows);
  }

  async function refreshVault0Projects(): Promise<ProjectRecord[]> {
    const rows = await vaultApi().vault0.listProjects(vault0BaseUrl.trim());
    setVault0Projects(rows);
    setVault0SourceProjectId((current) => {
      if (current && rows.some((project) => project.id === current)) {
        return current;
      }
      return rows[0]?.id ?? "";
    });
    return rows;
  }

  async function refreshVault0Dashboard(projectId: string): Promise<void> {
    if (!projectId) {
      setTickets([]);
      setAgents([]);
      setMemoryEntries([]);
      setSelectedTicketId("");
      return;
    }

    setBoardLoading(true);
    try {
      const [nextTickets, nextAgents, nextMemory] = await Promise.all([
        vaultApi().vault0.listTickets(vault0BaseUrl.trim(), projectId),
        vaultApi().vault0.listAgents(vault0BaseUrl.trim(), projectId, true),
        vaultApi().vault0.listMemory(vault0BaseUrl.trim(), projectId, 50),
      ]);

      setTickets(nextTickets);
      setAgents(nextAgents);
      setMemoryEntries(nextMemory);
      setSelectedTicketId((current) =>
        current && nextTickets.some((ticket) => ticket.id === current) ? current : nextTickets[0]?.id ?? "",
      );

      const defaultAgentId = nextAgents.find((agent) => agent.isActive)?.agentId ?? nextAgents[0]?.agentId ?? "";
      setChatAgentId((current) =>
        current && nextAgents.some((agent) => agent.agentId === current) ? current : defaultAgentId,
      );
      setTicketDraft((current) => ({ ...current, assignee: current.assignee || defaultAgentId }));
      setLastRefreshedAt(new Date().toISOString());
    } finally {
      setBoardLoading(false);
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        setError("");
        const nextProjects = await refreshProjects();
        const firstProject = nextProjects.find((project) => !project.isArchived) ?? nextProjects[0];
        if (firstProject) {
          await refreshChat(firstProject.id, "");
        }
        const remoteProjects = await refreshVault0Projects();
        if (remoteProjects[0]?.id) {
          await refreshVault0Dashboard(remoteProjects[0].id);
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to initialize VAULT_1 desktop");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedProjectId) {
      return;
    }

    void refreshChat(selectedProjectId, chatAgentId);
  }, [selectedProjectId, chatAgentId]);

  useEffect(() => {
    if (!vault0SourceProjectId) {
      setTickets([]);
      setAgents([]);
      setMemoryEntries([]);
      setSelectedTicketId("");
      return;
    }

    void (async () => {
      try {
        setError("");
        await refreshVault0Dashboard(vault0SourceProjectId);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to refresh VAULT_0 dashboard");
      }
    })();
  }, [vault0BaseUrl, vault0SourceProjectId]);

  async function runAction(action: () => Promise<void>, successMessage: string): Promise<void> {
    try {
      setError("");
      setNotice("");
      await action();
      setNotice(successMessage);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Operation failed");
    }
  }

  async function createTicketFromDraft(): Promise<void> {
    if (!vault0SourceProjectId) {
      throw new Error("Select a VAULT_0 project first.");
    }

    await vaultApi().vault0.createTicket({
      baseUrl: vault0BaseUrl.trim(),
      projectId: vault0SourceProjectId,
      actor: ticketDraft.assignee.trim() || "vault1-desktop-architect",
      title: ticketDraft.title.trim(),
      type: ticketDraft.type,
      priority: ticketDraft.priority,
      status: ticketDraft.status,
      assignee: ticketDraft.assignee,
      specMarkdown: ticketDraft.specMarkdown,
      acceptanceCriteria: ticketDraft.acceptanceCriteria,
      testPlan: ticketDraft.testPlan,
    });
    setTicketDraft((current) => ({ ...EMPTY_TICKET_DRAFT, assignee: current.assignee }));
    await refreshVault0Dashboard(vault0SourceProjectId);
  }

  function openTicketDetails(ticketId: string): void {
    setSelectedTicketId(ticketId);
    setShowTicketDetailModal(true);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">VAULT_1</p>
          <h1>{selectedVault0Project ? `${selectedVault0Project.name} / ${VIEW_LABELS[view]}` : "Execution Workspace"}</h1>
          <p className="subtitle">
            {filteredTickets.length} / {tickets.length} issues
            {lastRefreshedAt ? ` | refreshed ${new Date(lastRefreshedAt).toLocaleTimeString()}` : ""}
          </p>
        </div>
        <div className="toolbar">
          <select value={vault0SourceProjectId} onChange={(event) => setVault0SourceProjectId(event.target.value)}>
            <option value="">Select VAULT_0 project</option>
            {vault0Projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name} ({project.id})
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() =>
              void runAction(async () => {
                await refreshProjects();
                const remoteProjects = await refreshVault0Projects();
                const targetProjectId = vault0SourceProjectId || remoteProjects[0]?.id || "";
                if (targetProjectId) {
                  await refreshVault0Dashboard(targetProjectId);
                }
              }, "Workspace refreshed")
            }
          >
            Refresh
          </button>
        </div>
      </header>

      {notice ? <p className="notice success">{notice}</p> : null}
      {error ? <p className="notice error">{error}</p> : null}

      <section className="grid-layout">
        <aside className="panel panel-sidebar">
          <div className="sidebar-brand">
            <div className="sidebar-logo">V</div>
            <div>
              <p className="sidebar-brand-title">ProjectHub</p>
              <p className="sidebar-brand-subtitle">VAULT_1 Desktop</p>
            </div>
          </div>

          <div className="sidebar-sprint">
            <p className="sidebar-sprint-title">Sprint 12</p>
            <select value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)}>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.isArchived ? `[Archived] ${project.name}` : project.name}
                </option>
              ))}
            </select>
            <div className="sidebar-progress">
              <span className="progress-segment todo" />
              <span className="progress-segment progress" />
              <span className="progress-segment review" />
              <span className="progress-segment done" />
            </div>
            <p className="sidebar-brand-subtitle">Execution workspace</p>
          </div>

          <div className="sidebar-nav">
            <p className="sidebar-section-label">Planning</p>
            <button
              type="button"
              className={`sidebar-nav-item ${view === "board" ? "active" : ""}`}
              onClick={() => setView("board")}
            >
              Board
            </button>
            <button
              type="button"
              className={`sidebar-nav-item ${view === "list" ? "active" : ""}`}
              onClick={() => setView("list")}
            >
              List
            </button>
            <button
              type="button"
              className={`sidebar-nav-item ${view === "backlog" ? "active" : ""}`}
              onClick={() => setView("backlog")}
            >
              Backlog
            </button>
          </div>

          <div className="divider" />
          <div className="sidebar-legend">
            <p className="sidebar-section-label">Workflow</p>
            <p className="sidebar-brand-subtitle">
              <span className="status-dot status-to-qualify" /> To Do {workflowCounts.toDo}
            </p>
            <p className="sidebar-brand-subtitle">
              <span className="status-dot status-in-progress" /> In Progress {workflowCounts.inProgress}
            </p>
            <p className="sidebar-brand-subtitle">
              <span className="status-dot status-in-review" /> In Review {workflowCounts.inReview}
            </p>
            <p className="sidebar-brand-subtitle">
              <span className="status-dot status-done" /> Done {workflowCounts.done}
            </p>
          </div>
        </aside>

        <section className="panel board-panel wide">
          <div className="panel-header">
            <h2>Tickets & {VIEW_LABELS[view]}</h2>
            <p>
              {selectedVault0Project
                ? `${selectedVault0Project.name} (${selectedVault0Project.id})`
                : "No VAULT_0 project selected"}
            </p>
          </div>

          <div className="board-toolbar">
            <div className="board-search">
              <input
                value={ticketSearch}
                onChange={(event) => setTicketSearch(event.target.value)}
                placeholder="Search issues..."
              />
            </div>
            <div className="board-filters">
              <select value={filterAssignee} onChange={(event) => setFilterAssignee(event.target.value)}>
                <option value="">Assignee</option>
                {ticketAssignees.map((assignee) => (
                  <option key={assignee} value={assignee}>
                    {assignee}
                  </option>
                ))}
              </select>
              <select value={filterPriority} onChange={(event) => setFilterPriority(event.target.value)}>
                <option value="">Priority</option>
                {["P0", "P1", "P2", "P3"].map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
              <select value={filterType} onChange={(event) => setFilterType(event.target.value)}>
                <option value="">Type</option>
                {["feature", "story", "task", "bug", "chore"].map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)}>
                <option value="">Status</option>
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="secondary"
                disabled={!vault0SourceProjectId || boardLoading}
                onClick={() =>
                  void runAction(async () => {
                    if (!vault0SourceProjectId) return;
                    await refreshVault0Dashboard(vault0SourceProjectId);
                  }, "VAULT_0 board refreshed")
                }
              >
                {boardLoading ? "Refreshing..." : "Refresh"}
              </button>
              <span className="board-count">
                {filteredTickets.length} / {tickets.length} issues
                {lastRefreshedAt ? ` | refreshed ${new Date(lastRefreshedAt).toLocaleTimeString()}` : ""}
              </span>
            </div>
            <button
              type="button"
              className="create-issue-button"
              disabled={!vault0SourceProjectId}
              onClick={() => setShowCreateTicketModal(true)}
            >
              + Create
            </button>
          </div>

          {view === "board" ? (
            <div className="board-scroll">
              {boardLoading ? (
                <div className="board-loading-skeleton">
                  {[1, 2, 3, 4].map((column) => (
                    <div key={column} className="column skeleton-column">
                      <div className="column-header">
                        <div className="column-title">
                          <span className="skeleton-dot" />
                          <strong>Loading...</strong>
                        </div>
                        <span className="column-count">0</span>
                      </div>
                      <div className="column-body">
                        {[1, 2, 3].map((card) => (
                          <div key={card} className="ticket-card skeleton-card" />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {BOARD_COLUMNS.map((status) => (
                    <div key={status} className="column">
                      <div className="column-header">
                        <div className="column-title">
                          <span className={`status-dot status-${status}`} />
                          <strong>{STATUS_LABELS[status]}</strong>
                        </div>
                        <span className="column-count">{groupedTickets.get(status)?.length ?? 0}</span>
                      </div>
                      <div className="column-body">
                        {(groupedTickets.get(status) ?? []).map((ticket) => (
                          <button
                            key={ticket.id}
                            type="button"
                            className={`ticket-card status-${ticket.status} ${selectedTicketId === ticket.id ? "active" : ""}`}
                            onClick={() => openTicketDetails(ticket.id)}
                          >
                            <p className="ticket-id">{ticket.id}</p>
                            <p className="ticket-title">{ticket.title}</p>
                            <p className={`status-pill status-${ticket.status}`}>{STATUS_LABELS[ticket.status]}</p>
                            <p className="ticket-meta">
                              {ticket.type} / {ticket.priority} / {ticket.assignee || "unassigned"}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {tickets.length === 0 ? (
                    <div className="column empty-board-column">
                      <div className="column-body">
                        <p className="ticket-meta">No tickets loaded from VAULT_0 API for this project.</p>
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          ) : null}

          {view === "list" ? (
            <div className="list-section">
              <table className="list-table">
                <thead>
                  <tr>
                    <th>Issue</th>
                    <th>Title</th>
                    <th>Type</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Assignee</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTickets.map((ticket) => (
                    <tr
                      key={ticket.id}
                      className={selectedTicketId === ticket.id ? "active" : ""}
                      onClick={() => openTicketDetails(ticket.id)}
                    >
                      <td className="mono-cell">{ticket.id}</td>
                      <td>{ticket.title}</td>
                      <td>{ticket.type}</td>
                      <td>{ticket.priority}</td>
                      <td>
                        <span className={`status-pill status-${ticket.status}`}>{STATUS_LABELS[ticket.status]}</span>
                      </td>
                      <td>{ticket.assignee || "Unassigned"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {view === "backlog" ? (
            <div className="backlog-section">
              <div className="backlog-sprint">
                <div>
                  <strong>Sprint 12</strong>
                  <span>Feb 3 - Feb 17, 2026</span>
                </div>
                <span>
                  {tickets.filter((ticket) => ticket.status === "done").length}/{Math.max(1, filteredTickets.length)} done
                </span>
              </div>
              <div className="backlog-list">
                {filteredTickets.map((ticket) => (
                  <button
                    key={ticket.id}
                    type="button"
                    className={`backlog-row ${selectedTicketId === ticket.id ? "active" : ""}`}
                    onClick={() => openTicketDetails(ticket.id)}
                  >
                    <span className="mono-cell">{ticket.id}</span>
                    <span className="backlog-title">{ticket.title}</span>
                    <span className={`status-pill status-${ticket.status}`}>{STATUS_LABELS[ticket.status]}</span>
                    <span className="backlog-points">{ticket.estimate} pts</span>
                    <span className="backlog-avatar">{ticket.assignee ? ticket.assignee.slice(0, 2).toUpperCase() : "NA"}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

        </section>

        <aside className="panel aux-panel">
          <h2>VAULT_0 API Source</h2>
          <input
            value={vault0BaseUrl}
            onChange={(event) => setVault0BaseUrl(event.target.value)}
            placeholder="http://localhost:3000"
          />
          <button
            type="button"
            disabled={!vault0BaseUrl.trim()}
            onClick={() =>
              void runAction(async () => {
                const rows = await refreshVault0Projects();
                if (vault0SourceProjectId) {
                  await refreshVault0Dashboard(vault0SourceProjectId);
                } else if (rows[0]?.id) {
                  await refreshVault0Dashboard(rows[0].id);
                }
              }, "VAULT_0 projects loaded")
            }
          >
            Load VAULT_0 dashboard
          </button>
          <select value={vault0SourceProjectId} onChange={(event) => setVault0SourceProjectId(event.target.value)}>
            <option value="">Select VAULT_0 project</option>
            {vault0Projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name} ({project.id})
              </option>
            ))}
          </select>
          {selectedVault0Project ? (
            <div className="stack">
              <p className="ticket-meta">
                Project: {selectedVault0Project.name}
              </p>
              <p className="ticket-meta">
                Tickets: {tickets.length} | Agents: {agents.length} | Memory: {memoryEntries.length}
              </p>
            </div>
          ) : null}

          <div className="divider" />

          <h2>Project Admin</h2>
          <div className="stack">
            <input
              value={newProjectName}
              onChange={(event) => setNewProjectName(event.target.value)}
              placeholder="New project name"
            />
            <textarea
              value={newProjectDescription}
              onChange={(event) => setNewProjectDescription(event.target.value)}
              placeholder="Description"
              rows={3}
            />
            <button
              type="button"
              disabled={!newProjectName.trim()}
              onClick={() =>
                void runAction(async () => {
                  await vaultApi().projects.create({
                    name: newProjectName.trim(),
                    description: newProjectDescription,
                  });
                  setNewProjectName("");
                  setNewProjectDescription("");
                  await refreshProjects();
                }, "Project created")
              }
            >
              Create project
            </button>
            {selectedProject ? (
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  void runAction(async () => {
                    await vaultApi().projects.archive(selectedProject.id, !selectedProject.isArchived);
                    await refreshProjects();
                  }, selectedProject.isArchived ? "Project unarchived" : "Project archived")
                }
              >
                {selectedProject.isArchived ? "Unarchive project" : "Archive project"}
              </button>
            ) : null}
          </div>

          <details className="desktop-tools">
            <summary>Plug from local path</summary>
            <div className="stack">
              <input
                value={importPathName}
                onChange={(event) => setImportPathName(event.target.value)}
                placeholder="Project name"
              />
              <input
                value={importPathValue}
                onChange={(event) => setImportPathValue(event.target.value)}
                placeholder="C:\\path\\to\\repo"
              />
              <button
                type="button"
                disabled={!importPathName.trim() || !importPathValue.trim()}
                onClick={() =>
                  void runAction(async () => {
                    await vaultApi().projects.importFromPath({
                      name: importPathName.trim(),
                      repoPath: importPathValue.trim(),
                    });
                    setImportPathName("");
                    setImportPathValue("");
                    await refreshProjects();
                  }, "Local project plugged")
                }
              >
                Plug local project
              </button>
            </div>
          </details>

          <details className="desktop-tools">
            <summary>Plug from git URL</summary>
            <div className="stack">
              <input
                value={importGitName}
                onChange={(event) => setImportGitName(event.target.value)}
                placeholder="Project name"
              />
              <input
                value={importGitUrl}
                onChange={(event) => setImportGitUrl(event.target.value)}
                placeholder="https://github.com/org/repo.git"
              />
              <button
                type="button"
                disabled={!importGitName.trim() || !importGitUrl.trim()}
                onClick={() =>
                  void runAction(async () => {
                    await vaultApi().projects.importFromGit({
                      name: importGitName.trim(),
                      repoUrl: importGitUrl.trim(),
                    });
                    setImportGitName("");
                    setImportGitUrl("");
                    await refreshProjects();
                  }, "Git repository cloned and plugged")
                }
              >
                Clone and plug
              </button>
            </div>
          </details>

          <div className="divider" />

          <h2>Agents Chat</h2>
          <select value={chatAgentId} onChange={(event) => setChatAgentId(event.target.value)}>
            <option value="">All agents</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.agentId}>
                {agent.displayName} ({agent.agentId})
              </option>
            ))}
          </select>
          <div className="chat-list">
            {chatMessages.map((message) => (
              <article key={message.id} className="chat-item">
                <p className="ticket-meta">
                  {message.author} {"->"} {message.agentId}
                </p>
                <p>{message.content}</p>
              </article>
            ))}
          </div>
          <textarea
            rows={3}
            value={chatText}
            onChange={(event) => setChatText(event.target.value)}
            placeholder="Message to selected agent"
          />
          <button
            type="button"
            disabled={!selectedProjectId || !chatAgentId || !chatText.trim()}
            onClick={() =>
              void runAction(async () => {
                await vaultApi().chat.send({
                  projectId: selectedProjectId,
                  agentId: chatAgentId,
                  author: "boss",
                  content: chatText.trim(),
                });
                setChatText("");
                await refreshChat(selectedProjectId, chatAgentId);
              }, "Message sent")
            }
          >
            Send to agent
          </button>

          <div className="divider" />

          <h2>Memory</h2>
          <textarea
            rows={3}
            value={memorySummary}
            onChange={(event) => setMemorySummary(event.target.value)}
            placeholder="Session summary (read-only while dashboard is bound to VAULT_0 API)"
          />
          <button
            type="button"
            disabled
            onClick={() =>
              void runAction(async () => {
                setMemorySummary("");
              }, "Read-only")
            }
          >
            Memory is read-only from VAULT_0 API
          </button>

          <div className="memory-list">
            {memoryEntries.slice().reverse().map((entry) => (
              <article key={entry.session_id} className="chat-item">
                <p className="ticket-meta">
                  {entry.date} / {entry.agentId}
                </p>
                <p>{entry.task_summary}</p>
              </article>
            ))}
          </div>

          <h2>Handoff Preview</h2>
          <textarea rows={10} value={handoffText} readOnly placeholder="Generated handoff appears here" />
        </aside>
      </section>

      {showCreateTicketModal ? (
        <div className="modal-overlay" onClick={() => setShowCreateTicketModal(false)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">Create Issue</p>
                <h2>New Ticket</h2>
              </div>
              <button type="button" className="secondary modal-close" onClick={() => setShowCreateTicketModal(false)}>
                Close
              </button>
            </div>

            <div className="ticket-form">
              <input
                value={ticketDraft.title}
                onChange={(event) => setTicketDraft((current) => ({ ...current, title: event.target.value }))}
                placeholder="Summary"
              />
              <div className="grid-inline">
                <select
                  value={ticketDraft.type}
                  onChange={(event) =>
                    setTicketDraft((current) => ({ ...current, type: event.target.value as TicketDraft["type"] }))
                  }
                >
                  <option value="feature">feature</option>
                  <option value="story">story</option>
                  <option value="task">task</option>
                  <option value="bug">bug</option>
                  <option value="chore">chore</option>
                </select>
                <select
                  value={ticketDraft.priority}
                  onChange={(event) =>
                    setTicketDraft((current) => ({ ...current, priority: event.target.value as TicketDraft["priority"] }))
                  }
                >
                  <option value="P0">P0</option>
                  <option value="P1">P1</option>
                  <option value="P2">P2</option>
                  <option value="P3">P3</option>
                </select>
                <select
                  value={ticketDraft.status}
                  onChange={(event) =>
                    setTicketDraft((current) => ({ ...current, status: event.target.value as TicketStatus }))
                  }
                >
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
                <select
                  value={ticketDraft.assignee}
                  onChange={(event) => setTicketDraft((current) => ({ ...current, assignee: event.target.value }))}
                >
                  <option value="">Unassigned</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.agentId}>
                      {agent.displayName} ({agent.agentId})
                    </option>
                  ))}
                </select>
              </div>
              <textarea
                rows={3}
                value={ticketDraft.specMarkdown}
                onChange={(event) => setTicketDraft((current) => ({ ...current, specMarkdown: event.target.value }))}
                placeholder="Description / specification"
              />
              <textarea
                rows={2}
                value={ticketDraft.acceptanceCriteria}
                onChange={(event) =>
                  setTicketDraft((current) => ({ ...current, acceptanceCriteria: event.target.value }))
                }
                placeholder="Acceptance criteria"
              />
              <textarea
                rows={2}
                value={ticketDraft.testPlan}
                onChange={(event) => setTicketDraft((current) => ({ ...current, testPlan: event.target.value }))}
                placeholder="Test plan"
              />
              <div className="modal-actions">
                <button type="button" className="secondary" onClick={() => setShowCreateTicketModal(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!vault0SourceProjectId || !ticketDraft.title.trim()}
                  onClick={() =>
                    void runAction(async () => {
                      await createTicketFromDraft();
                      setShowCreateTicketModal(false);
                    }, "Ticket created")
                  }
                >
                  Create ticket
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showTicketDetailModal && selectedTicket ? (
        <div className="ticket-modal-overlay" onClick={() => setShowTicketDetailModal(false)}>
          <div className="ticket-modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="ticket-modal-header">
              <div>
                <p className="eyebrow">{selectedTicket.id}</p>
                <h2>{selectedTicket.title}</h2>
              </div>
              <div className="toolbar">
                <select
                  value={selectedTicket.status}
                  onChange={(event) => {
                    const nextStatus = event.target.value as TicketStatus;
                    void runAction(async () => {
                      await vaultApi().vault0.updateTicketStatus({
                        baseUrl: vault0BaseUrl.trim(),
                        ticketId: selectedTicket.id,
                        status: nextStatus,
                        actor: selectedTicket.assignee || "vault1-desktop-architect",
                      });
                      await refreshVault0Dashboard(vault0SourceProjectId);
                    }, `Ticket moved to ${STATUS_LABELS[nextStatus]}`);
                  }}
                >
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    void runAction(async () => {
                      const { filePath } = await vaultApi().vault0.exportTicketMarkdown({
                        baseUrl: vault0BaseUrl.trim(),
                        ticketId: selectedTicket.id,
                      });
                      setNotice(`Ticket exported: ${filePath}`);
                    }, "Ticket markdown exported")
                  }
                >
                  Export markdown
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={!vault0SourceProjectId}
                  onClick={() =>
                    void runAction(async () => {
                      const { handoff } = await vaultApi().vault0.generateHandoff({
                        baseUrl: vault0BaseUrl.trim(),
                        projectId: vault0SourceProjectId,
                        ticketId: selectedTicket.id,
                        memoryLimit: 5,
                      });
                      setHandoffText(handoff);
                      await navigator.clipboard.writeText(handoff);
                    }, "Handoff generated and copied")
                  }
                >
                  Copy handoff
                </button>
                <button type="button" className="secondary" onClick={() => setShowTicketDetailModal(false)}>
                  Close
                </button>
              </div>
            </div>
            <p className="ticket-meta">
              {selectedTicket.type} / {selectedTicket.priority} / {selectedTicket.assignee || "unassigned"}
            </p>
            <p className={`status-pill status-${selectedTicket.status}`}>{STATUS_LABELS[selectedTicket.status]}</p>

            <div className="ticket-modal-grid">
              <section className="ticket-modal-block">
                <h4>Specification</h4>
                <pre>{selectedTicket.specMarkdown || "No spec"}</pre>
              </section>
              <section className="ticket-modal-block">
                <h4>Acceptance Criteria</h4>
                <pre>{selectedTicket.acceptanceCriteria || "No acceptance criteria"}</pre>
              </section>
              <section className="ticket-modal-block ticket-modal-block-full">
                <h4>Test Plan</h4>
                <pre>{selectedTicket.testPlan || "No test plan"}</pre>
              </section>
            </div>
          </div>
        </div>
      ) : null}

      {loading ? <p className="notice">Loading desktop workspace...</p> : null}
    </main>
  );
}
