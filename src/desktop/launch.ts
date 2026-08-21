export function desktopLaunchUrl(ticket?: string, controlSecret?: string) {
  const params = new URLSearchParams();
  if (ticket) params.set("ticket", ticket);
  if (controlSecret) params.set("control", controlSecret);
  const query = params.toString();
  return `thoughtspace://open-orb${query ? `?${query}` : ""}`;
}

export function desktopDownloadUrl() {
  return process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL ?? null;
}
