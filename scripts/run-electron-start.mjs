import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const electronBinary = require("electron");

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
delete env.VITE_DEV_SERVER_URL;

const child = spawn(electronBinary, ["."], {
  cwd: process.cwd(),
  env,
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error("[electron-start-launcher] failed to start electron:", error);
  process.exit(1);
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
