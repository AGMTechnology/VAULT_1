import { app, BrowserWindow } from "electron";
import path from "node:path";

import { registerVaultIpc } from "./ipc";
import { VaultCore } from "../src/main/core/vault-core";

let mainWindow: BrowserWindow | null = null;

async function createWindow(): Promise<void> {
  const userData = app.getPath("userData");
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
    backgroundColor: "#0b1020",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const devServer = process.env.VITE_DEV_SERVER_URL;
  if (devServer) {
    await mainWindow.loadURL(devServer);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    await mainWindow.loadFile(path.join(__dirname, "../../renderer/index.html"));
  }

  mainWindow.on("closed", () => {
    core.close();
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  void createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
