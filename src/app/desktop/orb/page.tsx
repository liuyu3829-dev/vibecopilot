"use client";

import { Microphone, Stop, X } from "@phosphor-icons/react";
import { FormEvent, PointerEvent, useEffect, useRef, useState } from "react";
import "./orb.css";
import { closeAudioContext, connectAudioGraph, disconnectAudioGraph, type AudioGraph } from "@/lib/audio-session";
import { encodePcm16, mergeAssemblyTranscript, parseAssemblyTurn, type TranscriptState } from "@/lib/assembly-stream";
import { replaceTranscriptAfterManualEdit, shouldAcceptCaptureMessage } from "@/lib/capture-session";
import { desktopShell } from "@/lib/desktop-shell";

type PointerState = { x: number; y: number; moved: boolean; timer: number | null };

export default function DesktopOrbPage() {
  const [expanded, setExpanded] = useState(false);
  const [recording, setRecording] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState("");
  const [desktopToken, setDesktopToken] = useState<string | null>(null);
  const socket = useRef<WebSocket | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const graph = useRef<AudioGraph | null>(null);
  const transcript = useRef<TranscriptState>({ confirmed: "", live: "" });
  const run = useRef(0);
  const pointer = useRef<PointerState | null>(null);

  const apiFetch = (input: RequestInfo | URL, init?: RequestInit) => fetch(input, {
    ...init,
    headers: { ...init?.headers, ...(desktopToken ? { Authorization: `Bearer ${desktopToken}` } : {}) },
  });

  const stop = () => {
    run.current += 1;
    disconnectAudioGraph(graph.current);
    graph.current = null;
    const activeSocket = socket.current;
    socket.current = null;
    if (activeSocket?.readyState === WebSocket.OPEN) activeSocket.send(JSON.stringify({ type: "Terminate" }));
    if (activeSocket && activeSocket.readyState < WebSocket.CLOSED) activeSocket.close();
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    const context = audio.current;
    audio.current = null;
    void closeAudioContext(context);
    setRecording(false);
  };

  useEffect(() => {
    const ticket = new URLSearchParams(window.location.search).get("ticket");
    desktopShell().token().then(async (stored) => {
      if (stored) { setDesktopToken(stored); return; }
      if (!ticket) { setNotice("请从网页点击“打开桌面悬浮球”完成配对。"); return; }
      const response = await fetch("/api/desktop/pair/exchange", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticket }) });
      const result = await response.json();
      if (!response.ok || !result.data?.token) { setNotice(result.error?.message ?? "桌面配对失败，请从网页重新打开。"); return; }
      await desktopShell().setToken(result.data.token);
      setDesktopToken(result.data.token);
      window.history.replaceState({}, "", "/desktop/orb");
    }).catch(() => setNotice("桌面安全存储不可用。"));
  }, []);

  useEffect(() => {
    document.documentElement.classList.add("desktop-orb-document");
    document.body.classList.add("desktop-orb-document");
    return () => {
      document.documentElement.classList.remove("desktop-orb-document");
      document.body.classList.remove("desktop-orb-document");
      stop();
    };
  }, []);

  const start = async (initialDraft = "") => {
    stop();
    const activeRun = run.current;
    transcript.current = { confirmed: initialDraft, live: "" };
    setDraft(initialDraft);
    setNotice("正在请求麦克风…");
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (run.current !== activeRun) { media.getTracks().forEach((track) => track.stop()); return; }
      stream.current = media;
      setNotice("正在连接实时转写…");
      const response = await apiFetch("/api/speech/session?language=cn");
      const session = await response.json();
      if (!session.data?.url) throw new Error("Speech unavailable");
      const context = new AudioContext();
      const webSocket = new WebSocket(session.data.url);
      audio.current = context;
      socket.current = webSocket;
      webSocket.onmessage = (event) => {
        if (!shouldAcceptCaptureMessage(run.current, activeRun)) return;
        transcript.current = mergeAssemblyTranscript(transcript.current, parseAssemblyTurn(event.data), "cn");
        setDraft(`${transcript.current.confirmed}${transcript.current.live}`);
      };
      webSocket.onerror = () => setNotice("实时转写连接失败，请重新录音。");
      webSocket.onopen = () => {
        if (run.current !== activeRun) { webSocket.close(); media.getTracks().forEach((track) => track.stop()); void closeAudioContext(context); return; }
        graph.current = connectAudioGraph(context, media, (samples, sampleRate) => {
          if (webSocket.readyState === WebSocket.OPEN) webSocket.send(encodePcm16(samples, sampleRate));
        });
        setNotice("");
        setRecording(true);
      };
    } catch {
      stop();
      setNotice("无法访问麦克风或启动实时转写，请检查系统麦克风权限。");
    }
  };

  const open = async () => {
    try {
      await desktopShell().resize(true);
      setExpanded(true);
      await start();
    } catch {
      setNotice("桌面球无法展开，请重新打开桌面宠物。");
    }
  };

  const collapse = async () => {
    stop();
    transcript.current = { confirmed: "", live: "" };
    setDraft("");
    setExpanded(false);
    setNotice("");
    await desktopShell().resize(false);
  };

  const clearPointerTimer = () => {
    const timer = pointer.current?.timer;
    if (timer !== null && timer !== undefined) window.clearTimeout(timer);
  };

  const beginNativeDrag = () => {
    const current = pointer.current;
    if (!current || current.moved) return;
    current.moved = true;
    clearPointerTimer();
    void desktopShell().drag();
  };

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointer.current = { x: event.screenX, y: event.screenY, moved: false, timer: window.setTimeout(beginNativeDrag, 180) };
  };

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const current = pointer.current;
    if (!current || current.moved) return;
    if (Math.abs(event.screenX - current.x) > 5 || Math.abs(event.screenY - current.y) > 5) beginNativeDrag();
  };

  const handlePointerUp = () => {
    const moved = pointer.current?.moved;
    clearPointerTimer();
    pointer.current = null;
    if (!moved) void open();
  };

  const updateDraft = (value: string) => {
    if (!recording) {
      transcript.current = { confirmed: value, live: "" };
      setDraft(value);
      return;
    }
    const next = replaceTranscriptAfterManualEdit({ run: run.current, transcript: transcript.current }, value);
    run.current = next.run;
    transcript.current = next.transcript;
    setDraft(value);
    stop();
    setNotice("已保留你的修改。点击开始说话后继续录音。");
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft.trim()) { setNotice("请先录入一条想法。"); return; }
    setSaving(true);
    try {
      const response = await apiFetch("/api/thoughts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transcript: draft.trim(), language: "cn", source: "desktop_orb" }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message ?? "保存失败");
      stop();
      await apiFetch(`/api/thoughts/${result.data.id}/analysis`, { method: "POST" });
      setDraft("");
      transcript.current = { confirmed: "", live: "" };
      setNotice("已保存到 Thought Space");
      window.setTimeout(() => void collapse(), 1000);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "保存失败，请重试。");
    } finally {
      setSaving(false);
    }
  };

  if (!expanded) {
    return <main className="orb-stage"><button className="orb-idle" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onContextMenu={(event) => event.preventDefault()} aria-label="打开桌面悬浮球"><img src="/assets/thought-space-orb-v2.png" alt="" /></button></main>;
  }

  return <main className="orb-stage"><section className="orb-card"><header><span>{recording ? "正在聆听…" : "桌面捕捉"}</span><button onClick={() => void collapse()} aria-label="收起悬浮球"><X size={17} /></button></header><div className="orb-summary"><img src="/assets/thought-space-orb-v2.png" alt="" /><p>{recording ? "正在实时转写，你说的话会出现在下方。" : "点击麦克风开始说话。"}</p></div><button className="orb-record-button" type="button" onClick={() => recording ? stop() : void start(draft)}>{recording ? <><Stop size={18} /> 停止录音</> : <><Microphone size={18} /> 开始说话</>}</button><form onSubmit={save}><textarea autoFocus value={draft} onChange={(event) => updateDraft(event.target.value)} placeholder="开始说话，或直接输入…" /><div className="orb-actions"><button type="button" onClick={() => void collapse()}>关闭</button><button className="orb-save" disabled={saving}>{saving ? "保存中…" : "保存"}</button></div></form>{notice && <p className="orb-notice">{notice}</p>}</section></main>;
}
