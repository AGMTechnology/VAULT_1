import { useEffect, useMemo, useState } from "react";

import type { AgentRecord, ChatMessage, MemoryEntry, ProjectRecord, TicketRecord, TicketStatus } from "@shared/contracts";

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

  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");
  const [importPathName, setImportPathName] = useState("");
  const [importPathValue, setImportPathValue] = useState("");
  const [importGitName, setImportGitName] = useState("");
  const [importGitUrl, setImportGitUrl] = useState("");

  const [ticketDraft, setTicketDraft] = useState<TicketDraft>(EMPTY_TICKET_DRAFT);
  const [memorySummary, setMemorySummary] = useState("");
  const [chatText, setChatText] = useState("");

  const [loading, setLoading] = useState(false);
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

  const groupedTickets = useMemo(() => {
    const groups = new Map<TicketStatus, TicketRecord[]>();
    STATUSES.forEach((status) => groups.set(status, []));
    tickets.forEach((ticket) => {
      groups.get(ticket.status)?.push(ticket);
    });
    return groups;
  }, [tickets]);

  async function refreshProjects(): Promise<ProjectRecord[]> {
    const rows = await window.vault.projects.list(true);
    setProjects(rows);
    setSelectedProjectId((current) => {
      if (current && rows.some((project) => project.id === current)) {
        return current;
      }
      return rows.find((project) => !project.isArchived)?.id ?? rows[0]?.id ?? "";
    });
    return rows;
  }

  async function refreshProjectData(projectId: string): Promise<void> {
    if (!projectId) {
      setTickets([]);
      setAgents([]);
      setChatMessages([]);
      setMemoryEntries([]);
      return;
    }

    const [nextTickets, nextAgents, nextMemory] = await Promise.all([
      window.vault.tickets.list(projectId),
      window.vault.agents.list(projectId, true),
      window.vault.memory.list(projectId, 50),
    ]);

    setTickets(nextTickets);
    setAgents(nextAgents);
    setMemoryEntries(nextMemory);
    setSelectedTicketId((current) => (current && nextTickets.some((ticket) => ticket.id === current) ? current : nextTickets[0]?.id ?? ""));

    const defaultAgentId = nextAgents.find((agent) => agent.isActive)?.agentId ?? nextAgents[0]?.agentId ?? "";
    setChatAgentId((current) => (current && nextAgents.some((agent) => agent.agentId === current) ? current : defaultAgentId));
    setTicketDraft((current) => ({ ...current, assignee: current.assignee || defaultAgentId }));
  }

  async function refreshChat(projectId: string, agentId: string): Promise<void> {
    if (!projectId) {
      setChatMessages([]);
      return;
    }

    const rows = await window.vault.chat.list({ projectId, agentId: agentId || undefined });
    setChatMessages(rows);
  }

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        setError("");
        const nextProjects = await refreshProjects();
        const firstProject = nextProjects.find((project) => !project.isArchived) ?? nextProjects[0];
        if (firstProject) {
          await refreshProjectData(firstProject.id);
          await refreshChat(firstProject.id, "");
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

    void (async () => {
      try {
        setError("");
        await refreshProjectData(selectedProjectId);
        await refreshChat(selectedProjectId, chatAgentId);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to refresh project data");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId) {
      return;
    }

    void refreshChat(selectedProjectId, chatAgentId);
  }, [selectedProjectId, chatAgentId]);

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

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">VAULT_1</p>
          <h1>Desktop Local-First Control Center</h1>
          <p className="subtitle">
            Multi-project ticketing, board workflow, memory, handoff, multi-agent chat, and local/git project plug.
          </p>
        </div>
        <div className="toolbar">
          <select value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)}>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.isArchived ? `[Archived] ${project.name}` : project.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() =>
              void runAction(async () => {
                await refreshProjects();
                if (selectedProjectId) {
                  await refreshProjectData(selectedProjectId);
                  await refreshChat(selectedProjectId, chatAgentId);
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
        <aside className="panel">
          <h2>Projects</h2>
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
                  await window.vault.projects.create({
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
          </div>

          <div className="divider" />

          <h3>Plug from local path</h3>
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
                  await window.vault.projects.importFromPath({
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

          <h3>Plug from git URL</h3>
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
                  await window.vault.projects.importFromGit({
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

          {selectedProject ? (
            <div className="stack">
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  void runAction(async () => {
                    await window.vault.projects.archive(selectedProject.id, !selectedProject.isArchived);
                    await refreshProjects();
                  }, selectedProject.isArchived ? "Project unarchived" : "Project archived")
                }
              >
                {selectedProject.isArchived ? "Unarchive project" : "Archive project"}
              </button>
            </div>
          ) : null}
        </aside>

        <section className="panel wide">
          <div className="panel-header">
            <h2>Tickets & Board</h2>
            <p>{selectedProject ? `${selectedProject.name} (${selectedProject.id})` : "No project selected"}</p>
          </div>

          <div className="ticket-form">
            <input
              value={ticketDraft.title}
              onChange={(event) => setTicketDraft((current) => ({ ...current, title: event.target.value }))}
              placeholder="Ticket title"
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
              placeholder="Specification"
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
            <button
              type="button"
              disabled={!selectedProjectId || !ticketDraft.title.trim()}
              onClick={() =>
                void runAction(async () => {
                  await window.vault.tickets.create({
                    projectId: selectedProjectId,
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
                  await refreshProjectData(selectedProjectId);
                }, "Ticket created")
              }
            >
              Create ticket
            </button>
          </div>

          <div className="board-scroll">
            {STATUSES.map((status) => (
              <div key={status} className="column">
                <div className="column-header">
                  <strong>{STATUS_LABELS[status]}</strong>
                  <span>{groupedTickets.get(status)?.length ?? 0}</span>
                </div>
                <div className="column-body">
                  {(groupedTickets.get(status) ?? []).map((ticket) => (
                    <button
                      key={ticket.id}
                      type="button"
                      className={`ticket-card ${selectedTicketId === ticket.id ? "active" : ""}`}
                      onClick={() => setSelectedTicketId(ticket.id)}
                    >
                      <p className="ticket-id">{ticket.id}</p>
                      <p className="ticket-title">{ticket.title}</p>
                      <p className="ticket-meta">
                        {ticket.type} / {ticket.priority} / {ticket.assignee || "unassigned"}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {selectedTicket ? (
            <div className="ticket-detail">
              <div className="panel-header">
                <h3>{selectedTicket.id}</h3>
                <div className="toolbar">
                  <select
                    value={selectedTicket.status}
                    onChange={(event) => {
                      const nextStatus = event.target.value as TicketStatus;
                      void runAction(async () => {
                        await window.vault.tickets.updateStatus(selectedTicket.id, nextStatus);
                        await refreshProjectData(selectedProjectId);
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
                        const { filePath } = await window.vault.tickets.exportMarkdown(selectedTicket.id);
                        setNotice(`Ticket exported: ${filePath}`);
                      }, "Ticket markdown exported")
                    }
                  >
                    Export markdown
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() =>
                      void runAction(async () => {
                        const { handoff } = await window.vault.handoff.generate(selectedTicket.id);
                        setHandoffText(handoff);
                        await navigator.clipboard.writeText(handoff);
                      }, "Handoff generated and copied")
                    }
                  >
                    Copy handoff
                  </button>
                </div>
              </div>
              <p>{selectedTicket.title}</p>
              <p className="ticket-meta">
                {selectedTicket.type} / {selectedTicket.priority} / {selectedTicket.status}
              </p>
              <h4>Specification</h4>
              <pre>{selectedTicket.specMarkdown || "No spec"}</pre>
              <h4>Acceptance Criteria</h4>
              <pre>{selectedTicket.acceptanceCriteria || "No acceptance criteria"}</pre>
              <h4>Test Plan</h4>
              <pre>{selectedTicket.testPlan || "No test plan"}</pre>
            </div>
          ) : null}
        </section>

        <aside className="panel">
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
                await window.vault.chat.send({
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
            placeholder="Session summary"
          />
          <button
            type="button"
            disabled={!selectedProjectId || !memorySummary.trim()}
            onClick={() =>
              void runAction(async () => {
                await window.vault.memory.append(selectedProjectId, {
                  agentId: chatAgentId || "user",
                  task_summary: memorySummary.trim(),
                });
                setMemorySummary("");
                const next = await window.vault.memory.list(selectedProjectId, 20);
                setMemoryEntries(next);
              }, "Memory appended")
            }
          >
            Append memory
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

      {loading ? <p className="notice">Loading desktop workspace...</p> : null}
    </main>
  );
}
