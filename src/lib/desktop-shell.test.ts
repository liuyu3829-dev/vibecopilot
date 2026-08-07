import { beforeEach, describe, expect, it, vi } from "vitest";

const tauri = vi.hoisted(() => ({
  isTauri: vi.fn(),
  invoke: vi.fn(),
  startDragging: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: tauri.isTauri,
  invoke: tauri.invoke,
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({ startDragging: tauri.startDragging }),
}));

import { desktopShell } from "./desktop-shell";

describe("desktopShell", () => {
  beforeEach(() => {
    tauri.isTauri.mockReturnValue(true);
    tauri.invoke.mockResolvedValue(undefined);
    tauri.startDragging.mockResolvedValue(undefined);
    delete (window as Window & { __TAURI__?: unknown }).__TAURI__;
  });

  it("uses the official Tauri window API for native dragging", async () => {
    await desktopShell().drag();
    expect(tauri.startDragging).toHaveBeenCalledTimes(1);
  });

  it("uses the typed Tauri invoke API to resize the native window", async () => {
    await desktopShell().resize(true);
    expect(tauri.invoke).toHaveBeenCalledWith("resize_orb", { expanded: true });
  });
});
