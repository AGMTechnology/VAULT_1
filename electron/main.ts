import { app, BrowserWindow, dialog } from "electron";
import fs from "node:fs";
import path from "node:path";

import { registerVaultIpc } from "./ipc";
import { VaultCore } from "../src/main/core/vault-core";

let mainWindow: BrowserWindow | null = null;

async function createWindow(): Promise<void> {
  const userData = app.getPath("userData");
  const preloadPath = path.join(__dirname, "preload.js");
  if (!fs.existsSync(preloadPath)) {
    throw new Error(`Preload script not found: ${preloadPath}`);
  }

  const core = new VaultCore({
    dbPath: path.join(userData, "vault1.db"),
    dataRoot: path.join(userData, "data"),
  });
  await core.init();

  registerVaultIpc(core);

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1120,
    minHeight: 720,
    backgroundColor: "#f4f6fc",
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const devServer = process.env.VITE_DEV_SERVER_URL;
  if (devServer) {
    await mainWindow.loadURL(devServer);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    await mainWindow.loadFile(path.join(__dirname, "../../renderer/index.html"));
  }

  const currentWindow = mainWindow;
  currentWindow.webContents.once("did-finish-load", () => {
    void currentWindow.webContents
      .executeJavaScript("Boolean(window.vault && window.vault.vault0)")
      .then((bridgeReady) => {
        if (!bridgeReady) {
          dialog.showErrorBox(
            "VAULT_1 bridge error",
            "Desktop bridge is unavailable (window.vault/vault0). Restart the app.",
          );
        }
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error("Failed to validate renderer bridge:", error);
        dialog.showErrorBox("VAULT_1 bridge error", message);
      });
  });

  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    const details = `Code: ${errorCode}\nURL: ${validatedURL}\n${errorDescription}`;
    console.error("Renderer failed to load:", details);
    dialog.showErrorBox("VAULT_1 renderer load failure", details);
  });

  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    const message = `Reason: ${details.reason}\nExit code: ${details.exitCode}`;
    console.error("Renderer process crashed:", message);
    dialog.showErrorBox("VAULT_1 renderer crash", message);
  });

  mainWindow.on("closed", () => {
    core.close();
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Failed to initialize VAULT_1 desktop:", error);
    dialog.showErrorBox("VAULT_1 startup error", message);
    app.quit();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow().catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error("Failed to recreate VAULT_1 window:", error);
        dialog.showErrorBox("VAULT_1 startup error", message);
      });
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
