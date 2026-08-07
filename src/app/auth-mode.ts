export function shouldRequireAuth() {
  return process.env.NEXT_PUBLIC_THOUGHT_SPACE_GUEST_MODE === "true";
}