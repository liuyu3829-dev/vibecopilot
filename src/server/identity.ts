import { shouldRequireAuth } from "@/app/auth-mode";
import { supabaseUserId } from "./supabase";

export type Identity = { id: string; mode: "local" | "supabase" };
export const localIdentity: Identity = { id: "local-user", mode: "local" };

export function isSupabaseMode() { return shouldRequireAuth() && process.env.THOUGHT_SPACE_MODE === "supabase"; }

export async function requestIdentity(request: Request): Promise<Identity | null> {
  if (!shouldRequireAuth() || !isSupabaseMode()) return localIdentity;
  const id = await supabaseUserId(request);
  return id ? { id, mode: "supabase" } : null;
}
