export function bypassesAuthGate(pathname: string) {
  return pathname === "/auth/callback" || pathname === "/desktop/orb";
}
