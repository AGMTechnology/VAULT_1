import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("design system integration", () => {
  it("provides shared VAULT tokens and CSS variable usage", () => {
    const tokensPath = path.resolve(process.cwd(), "src/shared/design-tokens.ts");
    const stylesPath = path.resolve(process.cwd(), "src/renderer/styles.css");

    expect(fs.existsSync(tokensPath)).toBe(true);

    const styles = fs.readFileSync(stylesPath, "utf8");
    expect(styles).toContain("--vault-color-brand-purple");
    expect(styles).toContain("var(--vault-color-brand-purple)");
    expect(styles).toContain("var(--vault-color-surface-app)");
  });
});
