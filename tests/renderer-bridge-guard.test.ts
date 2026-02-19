import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("renderer bridge and UX guards", () => {
  it("uses a centralized vault API guard instead of raw window.vault access", () => {
    const appPath = path.resolve(process.cwd(), "src/renderer/App.tsx");
    const app = fs.readFileSync(appPath, "utf8");

    expect(app).toContain("function vaultApi()");
    expect(app).toContain("Desktop bridge unavailable (window.vault)");
    expect(app).toContain("vaultApi().vault0.listProjects");

    const rawWindowVaultMatches = app.match(/window\.vault/g) ?? [];
    expect(rawWindowVaultMatches.length).toBe(1);
  });

  it("keeps VAULT_0-like board interactions with search toolbar and create modal", () => {
    const appPath = path.resolve(process.cwd(), "src/renderer/App.tsx");
    const app = fs.readFileSync(appPath, "utf8");

    expect(app).toContain("board-toolbar");
    expect(app).toContain("Search issues...");
    expect(app).toContain("showCreateTicketModal");
    expect(app).toContain("modal-overlay");
    expect(app).toContain("Create Issue");
  });
});
