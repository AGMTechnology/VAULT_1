import { contextBridge, ipcRenderer } from "electron";

import { IPC_CHANNELS, type VaultApi } from "../src/shared/ipc";

const api: VaultApi = {
  health: () => ipcRenderer.invoke(IPC_CHANNELS.HEALTH),
  projects: {
    list: (includeArchived) => ipcRenderer.invoke(IPC_CHANNELS.PROJECTS_LIST, includeArchived),
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.PROJECTS_CREATE, input),
    archive: (projectId, isArchived) =>
      ipcRenderer.invoke(IPC_CHANNELS.PROJECTS_ARCHIVE, { projectId, isArchived }),
    importFromPath: (input) => ipcRenderer.invoke(IPC_CHANNELS.PROJECTS_IMPORT_PATH, input),
    importFromGit: (input) => ipcRenderer.invoke(IPC_CHANNELS.PROJECTS_IMPORT_GIT, input),
  },
  tickets: {
    list: (projectId) => ipcRenderer.invoke(IPC_CHANNELS.TICKETS_LIST, projectId),
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.TICKETS_CREATE, input),
    updateStatus: (ticketId, status) =>
      ipcRenderer.invoke(IPC_CHANNELS.TICKETS_UPDATE_STATUS, { ticketId, status }),
    exportMarkdown: (ticketId) => ipcRenderer.invoke(IPC_CHANNELS.TICKETS_EXPORT_MARKDOWN, ticketId),
  },
  agents: {
    list: (projectId, includeInactive) =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENTS_LIST, projectId, includeInactive),
    upsert: (input) => ipcRenderer.invoke(IPC_CHANNELS.AGENTS_UPSERT, input),
  },
  chat: {
    list: (input) => ipcRenderer.invoke(IPC_CHANNELS.CHAT_LIST, input),
    send: (input) => ipcRenderer.invoke(IPC_CHANNELS.CHAT_SEND, input),
  },
  memory: {
    list: (projectId, limit) => ipcRenderer.invoke(IPC_CHANNELS.MEMORY_LIST, projectId, limit),
    append: (projectId, input) => ipcRenderer.invoke(IPC_CHANNELS.MEMORY_APPEND, { projectId, input }),
  },
  handoff: {
    generate: (ticketId) => ipcRenderer.invoke(IPC_CHANNELS.HANDOFF_GENERATE, ticketId),
  },
  vault0: {
    overview: (baseUrl) => ipcRenderer.invoke(IPC_CHANNELS.VAULT0_OVERVIEW, baseUrl),
    importAgent: (input) => ipcRenderer.invoke(IPC_CHANNELS.VAULT0_IMPORT_AGENT, input),
    importTicket: (input) => ipcRenderer.invoke(IPC_CHANNELS.VAULT0_IMPORT_TICKET, input),
  },
};

contextBridge.exposeInMainWorld("vault", api);
