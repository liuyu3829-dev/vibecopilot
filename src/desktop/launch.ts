export function desktopLaunchUrl(ticket?: string, controlSecret?: string) {
  const params = new URLSearchParams();
  if (ticket) params.set("ticket", ticket);
  if (controlSecret) params.set("control", controlSecret);
  const query = params.toString();
  return `thoughtspace://open-orb${query ? `?${query}` : ""}`;
}

export function desktopHideUrl(controlSecret?: string) {
  const params = new URLSearchParams();
  if (controlSecret) params.set("control", controlSecret);
  const query = params.toString();
  return `thoughtspace://hide-orb${query ? `?${query}` : ""}`;
}
