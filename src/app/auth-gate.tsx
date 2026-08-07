"use client";

import { type ReactNode, useEffect, useState } from "react";
import { browserSupabase } from "@/lib/supabase-browser";
import { shouldRequireAuth } from "./auth-mode";

export function AuthGate({ children }: { children: ReactNode }) {
  if (!shouldRequireAuth()) return <>{children}</>;

  const client = browserSupabase();
  const [ready, setReady] = useState(!client);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!client) return;
    let active = true;
    const ensureAnonymousSession = async () => {
      const { data } = await client.auth.getSession();
      if (data.session) {
        if (active) setReady(true);
        return;
      }
      const { error: signInError } = await client.auth.signInAnonymously();
      if (!active) return;
      setError(signInError ? "Unable to prepare your private thought space. Please refresh." : "");
      setReady(!signInError);
    };
    void ensureAnonymousSession();
    const { data } = client.auth.onAuthStateChange((_event, session) => { if (session && active) setReady(true); });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, [client]);

  if (!ready) return <main className="auth-screen">{error || "Preparing your private thought space…"}</main>;
  return <>{children}</>;
}