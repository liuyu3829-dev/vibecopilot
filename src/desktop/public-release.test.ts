import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("public desktop-orb release flow", () => {
  it("creates an anonymous Supabase identity without showing a login screen", () => {
    const gate = readFileSync(resolve(process.cwd(), "src/app/auth-gate.tsx"), "utf8");
    expect(gate).toContain("signInAnonymously");
  });

  it("pairs the installed orb with the current browser identity before showing it", () => {
    const page = readFileSync(resolve(process.cwd(), "src/app/page.tsx"), "utf8");
    expect(page).toContain('fetch("/api/desktop/pair"');
    expect(page).toContain("desktopLaunchUrl(ticket, controlSecret)");
    expect(page).toContain("localStorage.setItem(\"thought-space-orb-control\"");
  });

  it("offers a direct public installer download without an invite-code prompt", () => {
    const page = readFileSync(resolve(process.cwd(), "src/app/page.tsx"), "utf8");
    const downloadRoute = readFileSync(resolve(process.cwd(), "src/app/api/desktop/download/route.ts"), "utf8");

    expect(page).not.toContain("desktopInvite");
    expect(page).not.toContain("window.prompt");
    expect(downloadRoute).not.toContain("BETA_ACCESS_REQUIRED");
    expect(downloadRoute).not.toContain("desktopBetaCookieName");
    expect(downloadRoute).not.toContain("@aws-sdk");
    expect(downloadRoute).toContain("DESKTOP_RELEASE_URL");
  });

  it("gives the bundled orb a remote API origin and a one-time pairing ticket", () => {
    const shell = readFileSync(resolve(process.cwd(), "public/orb-shell/index.html"), "utf8");
    const native = readFileSync(resolve(process.cwd(), "src-tauri/src/lib.rs"), "utf8");
    expect(shell).toContain('invoke("api_origin")');
    expect(shell).toContain('invoke("take_launch_ticket")');
    expect(shell).toContain('Authorization: desktopToken');
    expect(native).toContain("fn take_launch_ticket");
    expect(native).toContain("fn api_origin");
    expect(native).toContain("start_control_listener");
  });
});
