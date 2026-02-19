import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("renderer production build smoke", () => {
  it("uses relative Vite base for Electron file:// loading", () => {
    const viteConfigPath = path.resolve(process.cwd(), "vite.renderer.config.ts");
    const viteConfig = fs.readFileSync(viteConfigPath, "utf8");

    expect(viteConfig).toContain('base: "./"');
  });

  it("emits relative asset URLs in dist renderer index", () => {
    const indexPath = path.resolve(process.cwd(), "dist/renderer/index.html");
    expect(fs.existsSync(indexPath)).toBe(true);

    const indexHtml = fs.readFileSync(indexPath, "utf8");
    expect(indexHtml).toContain('src="./assets/');
    expect(indexHtml).toContain('href="./assets/');
    expect(indexHtml.includes('src="/assets/')).toBe(false);
    expect(indexHtml.includes('href="/assets/')).toBe(false);
  });
});
