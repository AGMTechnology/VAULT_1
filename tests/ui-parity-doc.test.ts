import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("UI parity documentation", () => {
  it("documents VAULT_0 -> VAULT_1 parity matrix and preserved desktop plugs", () => {
    const docPath = path.resolve(process.cwd(), "docs/ai/UI_PARITY_VAULT0_TO_VAULT1.md");
    expect(fs.existsSync(docPath)).toBe(true);

    const doc = fs.readFileSync(docPath, "utf8");
    expect(doc).toContain("UI Parity Matrix: VAULT_0 -> VAULT_1");
    expect(doc).toContain("Board status columns");
    expect(doc).toContain("Plug project from local path");
    expect(doc).toContain("Plug project from git URL");
    expect(doc).toContain("Legacy import bridge actions were removed");
  });
});
