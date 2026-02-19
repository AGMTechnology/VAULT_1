import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import { VaultCore } from "../src/main/core/vault-core";

const tempRoots: string[] = [];
const cores: VaultCore[] = [];

async function createTempRoot(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "vault1-desktop-test-"));
  tempRoots.push(root);
  return root;
}

afterEach(async () => {
  for (const core of cores.splice(0, cores.length)) {
    core.close();
  }
  await Promise.all(
    tempRoots.splice(0, tempRoots.length).map(async (root) => {
      await fs.rm(root, { recursive: true, force: true });
    }),
  );
});

describe("VaultCore", () => {
  it("creates tickets with project-prefixed sequence IDs and rejects unknown projects", async () => {
    const root = await createTempRoot();
    const core = new VaultCore({
      dbPath: path.join(root, "vault1.db"),
      dataRoot: path.join(root, "data"),
    });
    cores.push(core);
    await core.init();

    const project = await core.createProject({
      name: "VAULT_1",
      description: "Desktop app",
    });

    const first = await core.createTicket({
      projectId: project.id,
      title: "Boot desktop shell",
      type: "feature",
      priority: "P0",
      status: "ready",
      assignee: "vault1-desktop-architect",
    });

    const second = await core.createTicket({
      projectId: project.id,
      title: "Implement board module",
      type: "feature",
      priority: "P1",
      status: "to-qualify",
      assignee: "vault1-desktop-architect",
    });

    expect(first.id).toBe("VAULT-1-001");
    expect(second.id).toBe("VAULT-1-002");

    await expect(
      core.createTicket({
        projectId: "missing-project",
        title: "Should fail",
        type: "bug",
        priority: "P0",
        status: "ready",
        assignee: "vault1-desktop-architect",
      }),
    ).rejects.toThrow("Project not found");
  });

  it("imports local git projects and rejects invalid paths", async () => {
    const root = await createTempRoot();
    const repoPath = path.join(root, "local-repo");
    await fs.mkdir(path.join(repoPath, ".git"), { recursive: true });

    const core = new VaultCore({
      dbPath: path.join(root, "vault1.db"),
      dataRoot: path.join(root, "data"),
    });
    cores.push(core);
    await core.init();

    const imported = await core.importProjectFromPath({
      name: "Local Repo Project",
      repoPath,
    });

    expect(imported.repoPath).toBe(repoPath);

    await expect(
      core.importProjectFromPath({
        name: "Broken Repo",
        repoPath: path.join(root, "unknown"),
      }),
    ).rejects.toThrow("Project path does not exist");

    await expect(
      core.importProjectFromPath({
        name: "No Git Repo",
        repoPath: root,
      }),
    ).rejects.toThrow("Path is not a git repository");
  });

  it("stores per-project chat messages and filters by agent", async () => {
    const root = await createTempRoot();
    const core = new VaultCore({
      dbPath: path.join(root, "vault1.db"),
      dataRoot: path.join(root, "data"),
    });
    cores.push(core);
    await core.init();

    const project = await core.createProject({
      name: "Chat Project",
      description: "",
    });

    await core.upsertAgent({
      projectId: project.id,
      agentId: "codex-dev",
      displayName: "Codex Dev",
    });

    await core.upsertAgent({
      projectId: project.id,
      agentId: "vault1-desktop-architect",
      displayName: "Vault Architect",
    });

    await core.sendChatMessage({
      projectId: project.id,
      agentId: "codex-dev",
      author: "user",
      content: "Hello codex",
    });

    await core.sendChatMessage({
      projectId: project.id,
      agentId: "vault1-desktop-architect",
      author: "user",
      content: "Status update",
    });

    const allMessages = await core.listChatMessages({ projectId: project.id });
    expect(allMessages).toHaveLength(2);

    const architectMessages = await core.listChatMessages({
      projectId: project.id,
      agentId: "vault1-desktop-architect",
    });
    expect(architectMessages).toHaveLength(1);
    expect(architectMessages[0]?.content).toBe("Status update");
  });

  it("builds a handoff that includes the ticket and last 3 memory entries", async () => {
    const root = await createTempRoot();
    const core = new VaultCore({
      dbPath: path.join(root, "vault1.db"),
      dataRoot: path.join(root, "data"),
    });
    cores.push(core);
    await core.init();

    const project = await core.createProject({
      name: "Handoff Project",
      description: "",
      conventions: "Always run tests before status transitions.",
    });

    const ticket = await core.createTicket({
      projectId: project.id,
      title: "Implement desktop backlog",
      type: "feature",
      priority: "P0",
      status: "ready",
      assignee: "vault1-desktop-architect",
      specMarkdown: "Build backlog module",
      acceptanceCriteria: "Backlog supports filters",
      testPlan: "Unit + integration tests",
    });

    await core.appendMemory(project.id, {
      agentId: "codex-dev",
      task_summary: "old-1",
    });
    await core.appendMemory(project.id, {
      agentId: "codex-dev",
      task_summary: "old-2",
    });
    await core.appendMemory(project.id, {
      agentId: "codex-dev",
      task_summary: "recent-1",
    });
    await core.appendMemory(project.id, {
      agentId: "codex-dev",
      task_summary: "recent-2",
    });

    const handoff = await core.generateHandoff(ticket.id);
    expect(handoff).toContain("Implement desktop backlog");
    expect(handoff).toContain("Always run tests before status transitions.");
    expect(handoff).toContain("old-2");
    expect(handoff).toContain("recent-1");
    expect(handoff).toContain("recent-2");
    expect(handoff).not.toContain("old-1");
  });
});
