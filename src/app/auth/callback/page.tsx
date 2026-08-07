"use client";

import { useEffect, useState } from "react";
import { browserSupabase } from "@/lib/supabase-browser";

export default function AuthCallbackPage() {
  const [message, setMessage] = useState("正在验证登录链接…");
  useEffect(() => { const client = browserSupabase(); const code = new URLSearchParams(window.location.search).get("code"); if (!client || !code) { setMessage("登录配置缺失或链接无效。"); return; } client.auth.exchangeCodeForSession(code).then(({ error }) => { if (error) setMessage(error.message); else window.location.replace("/"); }); }, []);
  return <main className="auth-screen">{message}</main>;
}