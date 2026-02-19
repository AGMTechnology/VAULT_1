import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("renderer VAULT_0 API dashboard", () => {
  it("loads board data from VAULT_0 API channels with lazy loading states", () => {
    const appPath = path.resolve(process.cwd(), "src/renderer/App.tsx");
    const app = fs.readFileSync(appPath, "utf8");

    expect(app).toContain("vaultApi().vault0.listProjects");
    expect(app).toContain("vaultApi().vault0.listTickets");
    expect(app).toContain("vaultApi().vault0.createTicket");
    expect(app).toContain("vaultApi().vault0.updateTicketStatus");
    expect(app).toContain("boardLoading");
    expect(app).toContain("board-loading-skeleton");
  });

  it("drops import-bridge actions from dashboard section", () => {
    const appPath = path.resolve(process.cwd(), "src/renderer/App.tsx");
    const app = fs.readFileSync(appPath, "utf8");

    expect(app.includes("Import agent")).toBe(false);
    expect(app.includes("Import ticket")).toBe(false);
  });
});
