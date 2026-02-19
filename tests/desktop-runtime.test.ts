import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("desktop runtime scripts", () => {
  it("uses robust Electron launch scripts and strict renderer port", () => {
    const pkgPath = path.resolve(process.cwd(), "package.json");
    const raw = fs.readFileSync(pkgPath, "utf8");
    const pkg = JSON.parse(raw) as { scripts?: Record<string, string> };

    const devRenderer = pkg.scripts?.["dev:renderer"] ?? "";
    const devElectron = pkg.scripts?.["dev:electron"] ?? "";
    const start = pkg.scripts?.start ?? "";
    const rebuildNativeNode = pkg.scripts?.["rebuild:native:node"] ?? "";
    const rebuildNativeElectron = pkg.scripts?.["rebuild:native:electron"] ?? "";
    const stopDesktop = pkg.scripts?.["stop:desktop"] ?? "";
    const test = pkg.scripts?.test ?? "";

    expect(devRenderer).toContain("--strictPort");
    expect(devElectron).toContain("run-electron-dev.mjs");
    expect(start).toContain("run-electron-start.mjs");
    expect(rebuildNativeNode).toContain("npm rebuild better-sqlite3");
    expect(rebuildNativeElectron).toContain("--runtime=electron");
    expect(stopDesktop).toContain("stop-vault1-electron.ps1");
    expect(rebuildNativeNode).toContain("npm run stop:desktop");
    expect(rebuildNativeElectron).toContain("npm run stop:desktop");
    expect(devElectron).toContain("npm run rebuild:native:electron");
    expect(start).toContain("npm run rebuild:native:electron");
    expect(test).toContain("npm run rebuild:native:node");
  });

  it("explicitly removes ELECTRON_RUN_AS_NODE before spawning Electron", () => {
    const devLauncherPath = path.resolve(process.cwd(), "scripts/run-electron-dev.mjs");
    const startLauncherPath = path.resolve(process.cwd(), "scripts/run-electron-start.mjs");

    expect(fs.existsSync(devLauncherPath)).toBe(true);
    expect(fs.existsSync(startLauncherPath)).toBe(true);

    const devLauncher = fs.readFileSync(devLauncherPath, "utf8");
    const startLauncher = fs.readFileSync(startLauncherPath, "utf8");

    expect(devLauncher).toContain("delete env.ELECTRON_RUN_AS_NODE");
    expect(startLauncher).toContain("delete env.ELECTRON_RUN_AS_NODE");
  });

  it("desktop shortcut launcher runs desktop start flow, not browser dev flow", () => {
    const launcherPath = path.resolve(process.cwd(), "scripts/launch-vault1.ps1");
    expect(fs.existsSync(launcherPath)).toBe(true);

    const launcher = fs.readFileSync(launcherPath, "utf8");
    expect(launcher).toContain("run start");
    expect(launcher.includes("npm run dev")).toBe(false);
  });

  it("provides a desktop process cleanup script for native module rebuilds", () => {
    const stopScriptPath = path.resolve(process.cwd(), "scripts/stop-vault1-electron.ps1");
    expect(fs.existsSync(stopScriptPath)).toBe(true);

    const stopScript = fs.readFileSync(stopScriptPath, "utf8");
    expect(stopScript).toContain("Stop-Process");
    expect(stopScript).toContain("VAULT_1");
  });

  it("registers renderer crash/fail-load guards in Electron main", () => {
    const mainPath = path.resolve(process.cwd(), "electron/main.ts");
    const main = fs.readFileSync(mainPath, "utf8");

    expect(main).toContain("did-fail-load");
    expect(main).toContain("render-process-gone");
    expect(main).toContain("sandbox: false");
    expect(main).toContain("Preload script not found");
    expect(main).toContain("window.vault && window.vault.vault0");
  });
});
