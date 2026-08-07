export const thoughtSources = ["manual", "web", "desktop_orb"] as const;
export type ThoughtSource = (typeof thoughtSources)[number];

export function isThoughtSource(value: unknown): value is ThoughtSource {
  return typeof value === "string" && (thoughtSources as readonly string[]).includes(value);
}