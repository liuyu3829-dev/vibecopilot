import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DesktopOrbPage from "./page";

describe("DesktopOrbPage", () => {
  const drag = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    drag.mockClear();
    window.thoughtSpaceOrb = {
      resize: vi.fn().mockResolvedValue(undefined), drag,
      close: vi.fn().mockResolvedValue(undefined), token: vi.fn().mockResolvedValue(null),
      setToken: vi.fn().mockResolvedValue(undefined),
    };
  });

  it("uses native dragging when the orb is moved", () => {
    render(<DesktopOrbPage />);
    const orb = screen.getByRole("button", { name: "打开桌面悬浮球" });
    fireEvent.pointerDown(orb, { pointerId: 1, screenX: 100, screenY: 100 });
    fireEvent.pointerMove(orb, { pointerId: 1, screenX: 120, screenY: 120 });
    expect(drag).toHaveBeenCalledTimes(1);
  });

  it("waits for the native window to expand before rendering the recording card", async () => {
    let expand: (() => void) | undefined;
    const resize = vi.fn(() => new Promise<void>((resolve) => { expand = resolve; }));
    window.thoughtSpaceOrb = {
      resize, drag, close: vi.fn().mockResolvedValue(undefined),
      token: vi.fn().mockResolvedValue(null), setToken: vi.fn().mockResolvedValue(undefined),
    };
    render(<DesktopOrbPage />);
    const orb = screen.getByRole("button", { name: "打开桌面悬浮球" });
    fireEvent.pointerDown(orb, { pointerId: 1, screenX: 1, screenY: 1 });
    fireEvent.pointerUp(orb, { pointerId: 1, screenX: 1, screenY: 1 });
    expect(screen.queryByRole("button", { name: /开始说话/ })).not.toBeInTheDocument();
    expand?.();
    expect(await screen.findByRole("button", { name: /开始说话/ })).toBeInTheDocument();
  });

  it("resumes Web Audio before connecting the legacy desktop capture stream", () => {
    const page = readFileSync(resolve(process.cwd(), "src/app/desktop/orb/page.tsx"), "utf8");

    expect(page).toContain("await resumeAudioContext(context)");
    expect(page.indexOf("await resumeAudioContext(context)")).toBeLessThan(page.indexOf("connectAudioGraph(context, media,"));
    expect(page.indexOf("const context = new AudioContext();")).toBeLessThan(page.indexOf("await navigator.mediaDevices.getUserMedia"));
  });

  it("reports safe capture stages", () => {
    const page = readFileSync(resolve(process.cwd(), "src/app/desktop/orb/page.tsx"), "utf8");

    expect(page).toContain('"speech_session"');
    expect(page).toContain('"microphone"');
    expect(page).toContain('"audio_context"');
    expect(page).toContain('"streaming"');
  });

  it("waits for the AssemblyAI Begin handshake before sending legacy desktop audio", () => {
    const page = readFileSync(resolve(process.cwd(), "src/app/desktop/orb/page.tsx"), "utf8");

    expect(page).toContain('messageType === "Begin"');
    expect(page).toContain('startAudio(); return;');
    expect(page.indexOf("const startAudio =")).toBeLessThan(page.indexOf("webSocket.onmessage"));
    expect(page).toContain("window.setTimeout(failStreaming, 5000)");
  });
});
