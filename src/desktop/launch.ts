export type DesktopControl = "show" | "hide";

export function desktopControlUrl(action: DesktopControl) {
  return action === "show" ? "thoughtspace://open-orb" : "thoughtspace://hide-orb";
}

export function desktopLaunchUrl(ticket?: string) {
  return `thoughtspace://open-orb${ticket ? `?ticket=${encodeURIComponent(ticket)}` : ""}`;
}

export function desktopDownloadUrl() {
  return process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL ?? null;
}
