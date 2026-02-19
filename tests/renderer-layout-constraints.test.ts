import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("renderer layout constraints", () => {
  it("keeps sidebar and aux panels scrollable to prevent content overflow", () => {
    const stylesPath = path.resolve(process.cwd(), "src/renderer/styles.css");
    const styles = fs.readFileSync(stylesPath, "utf8");

    expect(styles).toContain(".panel-sidebar");
    expect(styles).toContain("overflow-y: auto");
    expect(styles).toContain(".aux-panel");
    expect(styles).toContain("overflow-x: hidden");
    expect(styles).toContain("grid-template-columns: var(--vault-layout-sidebar-width) minmax(0, 1fr) 340px");
  });

  it("applies bounded heights and modal detail layout for stable board rendering", () => {
    const stylesPath = path.resolve(process.cwd(), "src/renderer/styles.css");
    const styles = fs.readFileSync(stylesPath, "utf8");

    expect(styles).toContain(".board-scroll");
    expect(styles).toContain("grid-auto-columns: 280px");
    expect(styles).toContain("max-height: 62vh");
    expect(styles).toContain(".ticket-modal-card");
    expect(styles).toContain("max-height: 88vh");
    expect(styles).toContain(".ticket-modal-grid");
    expect(styles).toContain(".list-section");
    expect(styles).toContain(".backlog-section");
  });

  it("uses collapsible desktop tools to keep sidebar depth under control", () => {
    const stylesPath = path.resolve(process.cwd(), "src/renderer/styles.css");
    const appPath = path.resolve(process.cwd(), "src/renderer/App.tsx");
    const styles = fs.readFileSync(stylesPath, "utf8");
    const app = fs.readFileSync(appPath, "utf8");

    expect(styles).toContain(".desktop-tools");
    expect(app).toContain("<details className=\"desktop-tools\">");
    expect(app).toContain("Plug from local path");
    expect(app).toContain("Plug from git URL");
  });
});
