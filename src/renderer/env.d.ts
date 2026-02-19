import type { VaultApi } from "@shared/ipc";

declare global {
  interface Window {
    vault: VaultApi;
  }
}

export {};
