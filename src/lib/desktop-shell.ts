import { invoke, isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

export type DesktopShell = {
  resize: (expanded: boolean) => Promise<void>;
  drag: () => Promise<void>;
  close: () => Promise<void>;
  token: () => Promise<string | null>;
  setToken: (token: string) => Promise<void>;
};

declare global {
  interface Window {
    thoughtSpaceOrb?: DesktopShell;
  }
}

const browserShell: DesktopShell = {
  resize: async () => undefined,
  drag: async () => undefined,
  close: async () => window.close(),
  token: async () => null,
  setToken: async () => undefined,
};

const nativeShell: DesktopShell = {
  resize: async (expanded) => { await invoke("resize_orb", { expanded }); },
  drag: async () => { await getCurrentWindow().startDragging(); },
  close: async () => { await invoke("close_orb"); },
  token: async () => (await invoke("read_token")) as string | null,
  setToken: async (token) => { await invoke("store_token", { token }); },
};

export function desktopShell(): DesktopShell {
  if (typeof window === "undefined") return browserShell;
  if (isTauri()) return nativeShell;
  return window.thoughtSpaceOrb ?? browserShell;
}
