"use client";

import Image from "next/image";
import {
  Bell,
  CalendarBlank,
  CaretLeft,
  CaretRight,
  ChartBar,
  House,
  MagnifyingGlass,
  Microphone,
  NotePencil,
  Plus,
  Tag,
  Trash,
  Waveform,
  X,
} from "@phosphor-icons/react";
import { FormEvent, useEffect, useRef, useState } from "react";

import { closeAudioContext, connectAudioGraph, disconnectAudioGraph, type AudioGraph } from "@/lib/audio-session";
import { encodePcm16, mergeAssemblyTranscript, parseAssemblyTurn, type TranscriptState } from "@/lib/assembly-stream";
import { desktopControlUrl, desktopLaunchUrl } from "@/desktop/launch";
import { shouldRequireAuth } from "./auth-mode";

type Locale = "zh-CN" | "en";
type Thought = {
  id: string;
  transcript: string;
  language: "cn" | "en";
  capturedAt: string;
  summary: string | null;
  tags: string[];
  analysisStatus: "pending" | "complete" | "failed";
};
type Report = { theme: string; narrative: string; insights: string[]; sourceThoughtCount: number };
const text = {
  en: {
    home: "Home", thoughts: "Thoughts", reports: "Reports", voice: "Voice notes", tags: "Tags", search: "Search", settings: "Settings",
    newThought: "New thought", listening: "Listening…", ready: "Ready to listen", start: "Start listening", stop: "Stop", save: "Save thought",
    placeholder: "Write a thought, or start speaking…", close: "Close capture", captured: "thoughts captured", today: "Today’s thought report",
    generate: "Generate report", empty: "Your thoughts are quiet today.", retry: "Retry analysis", delete: "Delete", live: "Live capture",
    reportEmpty: "Capture a thought to reveal today’s pattern.", locale: "ZH", loading: "Connecting your thoughts…",
    loadError: "Unable to load your thoughts. Please refresh.", captureError: "Microphone access or transcription connection was not available.",
    draftError: "Capture or write a thought first.", saveError: "Unable to save your thought.", audioPrivacy: "Audio is processed live and is not saved.", wordsAppear: "Words appear as you speak.",
    quoteTitle: "Capture thoughts. Keep moving.", quote: "A private space for fragments before they disappear.", soon: "This room is being prepared.",
    mainTheme: "Main theme", signals: "Small signals", pattern: "Pattern, not pressure", gently: "Thoughts, collected gently",
  },
  "zh-CN": {
    home: "首页", thoughts: "想法", reports: "报告", voice: "语音笔记", tags: "标签", search: "搜索", settings: "设置",
    newThought: "新建想法", listening: "正在聆听…", ready: "准备聆听", start: "开始录音", stop: "停止", save: "保存想法",
    placeholder: "写下一条想法，或直接开始说话…", close: "关闭捕捉", captured: "条想法已记录", today: "今日思想报告",
    generate: "生成报告", empty: "今天的思绪还很安静。", retry: "重试分析", delete: "删除", live: "实时捕捉",
    reportEmpty: "先捕捉一条想法，再发现今天的思绪线索。", locale: "EN", loading: "正在连接你的想法…",
    loadError: "无法加载想法，请刷新后重试。", captureError: "无法访问麦克风或连接实时转写服务。", draftError: "请先说出或写下一条想法。",
    saveError: "无法保存这条想法。", audioPrivacy: "音频仅用于实时转写，不会被保存。", wordsAppear: "文字会随说话实时出现。",
    quoteTitle: "捕捉想法，继续向前。", quote: "在灵感消失前，为它留下一处私密空间。", soon: "这个空间正在准备中。",
    mainTheme: "核心主题", signals: "细小信号", pattern: "看见模式，而非压力", gently: "温柔收集每一个想法",
  },
} as const;

const nav = [House, NotePencil, ChartBar, Microphone, Tag, MagnifyingGlass] as const;

export default function Home() {
  const [locale, setLocale] = useState<Locale>("en");
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [recording, setRecording] = useState(false);
  const [voiceCaptured, setVoiceCaptured] = useState(false);
  const [notice, setNotice] = useState("");
  const [desktopInvite, setDesktopInvite] = useState("");
  const [section, setSection] = useState("Home");
  const socket = useRef<WebSocket | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const transcript = useRef<TranscriptState>({ confirmed: "", live: "" });
  const graph = useRef<AudioGraph | null>(null);
  const captureRun = useRef(0);
  const t = text[locale];
  const labels = [t.home, t.thoughts, t.reports, t.voice, t.tags, t.search];

  const load = async () => {
    try {
      const [thoughtResponse, reportResponse] = await Promise.all([
        fetch("/api/thoughts").then((response) => response.json()),
        fetch(`/api/reports/daily?locale=${locale}`).then((response) => response.json()),
      ]);
      setThoughts(thoughtResponse.data ?? []);
      setReport(reportResponse.data ?? null);
    } catch {
      setNotice(t.loadError);
    }
  };

  useEffect(() => { void load(); }, [locale]);
  useEffect(() => () => { stopRecording(); }, []);

  const stopRecording = () => {
    captureRun.current += 1;
    disconnectAudioGraph(graph.current);
    graph.current = null;
    const activeSocket = socket.current;
    socket.current = null;
    if (activeSocket?.readyState === WebSocket.OPEN) activeSocket.send(JSON.stringify({ type: "Terminate" }));
    if (activeSocket && activeSocket.readyState < WebSocket.CLOSED) activeSocket.close();
    const activeStream = stream.current;
    stream.current = null;
    activeStream?.getTracks().forEach((track) => track.stop());
    const context = audio.current;
    audio.current = null;
    void closeAudioContext(context);
    setRecording(false);
  };

  const startRecording = async () => {
    stopRecording();
    const run = captureRun.current;
    setNotice("");
    transcript.current = { confirmed: "", live: "" };
    try {
      const response = await fetch(`/api/speech/session?language=${locale === "zh-CN" ? "cn" : "en"}`);
      const session = await response.json();
      if (!session.data?.url) throw new Error(session.error?.message ?? "Speech unavailable");
      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (captureRun.current !== run) { mediaStream.getTracks().forEach((track) => track.stop()); return; }
      const context = new AudioContext();
      const webSocket = new WebSocket(session.data.url);
      stream.current = mediaStream;
      audio.current = context;
      socket.current = webSocket;
      webSocket.onmessage = (event) => {
        const expectedLanguage = locale === "zh-CN" ? "cn" : "en";
        transcript.current = mergeAssemblyTranscript(transcript.current, parseAssemblyTurn(event.data), expectedLanguage);
        setDraft(`${transcript.current.confirmed}${transcript.current.live}`);
      };
      webSocket.onerror = () => setNotice(t.captureError);
      webSocket.onopen = () => {
        if (captureRun.current !== run) { webSocket.close(); mediaStream.getTracks().forEach((track) => track.stop()); void closeAudioContext(context); return; }
        graph.current = connectAudioGraph(context, mediaStream, (samples, sampleRate) => {
          if (webSocket.readyState === WebSocket.OPEN) webSocket.send(encodePcm16(samples, sampleRate));
        });
        setVoiceCaptured(true);
        setRecording(true);
      };
    } catch {
      stopRecording();
      setNotice(t.captureError);
    }
  };

  const closeCapture = () => {
    stopRecording();
    setCaptureOpen(false);
  };

  const saveThought = async (event: FormEvent) => {
    event.preventDefault();
    const transcript = draft.trim();
    if (!transcript) { setNotice(t.draftError); return; }
    const response = await fetch("/api/thoughts", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript, language: locale === "zh-CN" ? "cn" : "en", source: voiceCaptured ? "web" : "manual" }),
    });
    const result = await response.json();
    if (!response.ok) { setNotice(result.error?.message ?? t.saveError); return; }
    stopRecording();
    setCaptureOpen(false);
    setDraft("");
    setVoiceCaptured(false);
    await fetch(`/api/thoughts/${result.data.id}/analysis`, { method: "POST" });
    await load();
  };

  const removeThought = async (id: string) => {
    await fetch(`/api/thoughts/${id}`, { method: "DELETE" });
    await load();
  };

  const downloadDesktopPet = async () => {
    const code = window.prompt(locale === "zh-CN" ? "输入桌面球测试邀请码" : "Enter your desktop orb invite code");
    if (!code) return;
    try {
      const response = await fetch("/api/desktop/beta", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message ?? "Download access was not granted.");
      window.location.assign("/api/desktop/download");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to start the download."); }
  };

  const controlDesktopPet = async (action: "show" | "hide") => {
    if (action === "hide") { window.location.assign(desktopControlUrl("hide")); return; }
    let launchUrl = desktopControlUrl("show");
    if (shouldRequireAuth()) {
      try {
        const response = await fetch("/api/desktop/pair", { method: "POST" });
        const result = await response.json();
        const ticket = result.data?.ticket;
        if (!response.ok || !ticket) throw new Error(result.error?.message ?? "Unable to pair the desktop orb.");
        launchUrl = desktopLaunchUrl(ticket);
      } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to pair the desktop orb."); return; }
    }
    window.location.assign(launchUrl);
  };
  const generateReport = async () => {
    setNotice(t.loading);
    const response = await fetch("/api/reports/daily", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locale }) });
    const result = await response.json();
    if (!response.ok) setNotice(result.error?.message ?? "Report generation failed.");
    else { setReport(result.data); setNotice(""); }
  };

  return (
    <main className="thought-space">
      <aside className="rail">
        <div className="brand"><Image src="/assets/thought-space-orb-v2.png" alt="" width={38} height={38} priority /><span>Thought Space</span></div>
        <nav className="nav-list" aria-label="Primary navigation">
          {labels.map((label, index) => {
            const Icon = nav[index];
            return <button aria-current={section === label ? "page" : undefined} key={label} onClick={() => setSection(label)}><Icon size={18} /><span>{label}</span></button>;
          })}
          <button aria-current={section === t.settings ? "page" : undefined} onClick={() => setSection(t.settings)}><CalendarBlank size={18} /><span>{t.settings}</span></button>
        </nav>
        <section className="calendar-card" aria-label="Calendar">
          <div className="calendar-heading"><strong>{new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(new Date())}</strong><span><button aria-label="Previous month"><CaretLeft size={16} /></button><button aria-label="Next month"><CaretRight size={16} /></button></span></div>
          <div className="week">{["M", "T", "W", "T", "F", "S", "S"].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div>
          <div className="days">{Array.from({ length: 31 }, (_, index) => <span className={index + 1 === new Date().getDate() ? "today" : ""} key={index}>{index + 1}</span>)}</div>
        </section>
        <div className="rail-quote"><Waveform size={24} /><p><strong>{t.quoteTitle}</strong><br />{t.quote}</p></div>
      </aside>

      <section className="timeline-shell">
        <header className="timeline-header">
          <div><h1 className="date-heading">{new Intl.DateTimeFormat(locale, { weekday: "long", month: "long", day: "numeric" }).format(new Date())}</h1><p>{thoughts.length} {t.captured}</p></div>
          <div className="header-actions"><button className="locale" onClick={() => setLocale(locale === "en" ? "zh-CN" : "en")}>{t.locale}</button><button className="new-thought" onClick={() => { setCaptureOpen(true); setNotice(""); }}><Plus size={17} />{t.newThought}</button><button aria-label="Notifications"><Bell size={18} /></button></div>
        </header>
        {section === t.settings ? <section className="desktop-settings">
          <div className="desktop-settings-heading"><Image src="/assets/thought-space-orb-v3.png" alt="" width={72} height={72} /><div><p className="eyebrow">{locale === "zh-CN" ? "桌面端" : "DESKTOP COMPANION"}</p><h2>{locale === "zh-CN" ? "桌面球" : "Desktop orb"}</h2><p>{locale === "zh-CN" ? "下载、显示或隐藏你的桌面捕捉球。" : "Download, show or hide your desktop capture orb."}</p></div></div>
          <div className="desktop-settings-card"><div><h3>{locale === "zh-CN" ? "安装桌面球" : "Install the desktop orb"}</h3><p>{locale === "zh-CN" ? "首次安装时输入测试邀请码；安装后无需重复下载。" : "Enter an invite code for the first installation. You will not need to download it again."}</p></div><label>{locale === "zh-CN" ? "测试邀请码" : "Invite code"}<input aria-label="Desktop orb invite code" value={desktopInvite} onChange={(event) => setDesktopInvite(event.target.value)} placeholder={locale === "zh-CN" ? "输入邀请码" : "Enter invite code"} /></label><button className="desktop-pet" type="button" onClick={() => void downloadDesktopPet()}>{locale === "zh-CN" ? "下载 Windows 版" : "Download for Windows"}</button></div>
          <div className="desktop-settings-card desktop-settings-actions"><div><h3>{locale === "zh-CN" ? "显示状态" : "Visibility"}</h3><p>{locale === "zh-CN" ? "已安装后，可随时快速显示或隐藏桌面球。" : "After installation, show or hide the orb instantly."}</p></div><span><button className="desktop-pet" type="button" onClick={() => void controlDesktopPet("show")}>{locale === "zh-CN" ? "显示桌面球" : "Show orb"}</button><button className="desktop-pet desktop-pet-hide" type="button" onClick={() => void controlDesktopPet("hide")}>{locale === "zh-CN" ? "隐藏桌面球" : "Hide orb"}</button></span></div>
        </section> : section !== t.home ? <section className="empty-state"><Waveform size={28} /><h2>{section}</h2><p>{t.soon}</p></section> : <div className="thought-list">
          {thoughts.length === 0 ? <section className="empty-state"><Image src="/assets/thought-space-orb-v2.png" alt="" width={76} height={76} /><p>{t.empty}</p><button onClick={() => setCaptureOpen(true)}>{t.newThought}</button></section> : thoughts.map((thought) => <article className="thought-card" key={thought.id}>
            <time>{new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(new Date(thought.capturedAt))}</time><span className="timeline-dot" />
            <div><p className="thought-copy">{thought.transcript}</p>{thought.summary && <p className="thought-summary">{thought.summary}</p>}<div className="chips">{thought.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>{thought.analysisStatus === "failed" && <button onClick={() => fetch(`/api/thoughts/${thought.id}/analysis`, { method: "POST" }).then(load)}>{t.retry}</button>}</div>
            <div className="thought-actions"><button aria-label={t.delete} onClick={() => removeThought(thought.id)}><Trash size={16} /></button></div>
          </article>)}
        </div>}
      </section>

      <aside className="report-column"><section className="report-card"><header><div><Waveform size={18} /><h2>{t.today}</h2></div><small>AI</small></header>
        {report ? <div><p className="report-label">{t.mainTheme}</p><section className="report-main"><h3>{report.theme}</h3><p>{report.narrative}</p></section><p className="report-label">{t.signals}</p><div className="insight-list">{report.insights.map((insight, index) => <section className="insight" key={insight}><ChartBar size={18} /><div><strong>0{index + 1}</strong><p>{insight}</p></div></section>)}</div></div> : <div className="report-empty"><Image src="/assets/thought-space-orb-v2.png" alt="" width={70} height={70} /><p>{t.reportEmpty}</p><button onClick={generateReport}>{t.generate}</button></div>}
      </section></aside>

      {captureOpen && <aside className={`capture-panel ${recording ? "is-recording" : ""}`} aria-label={t.newThought}>
        <div className="capture-topline"><div className="listening-label"><span className="live-dot" />{recording ? t.listening : t.live}</div><button onClick={closeCapture} aria-label={t.close}><X size={18} /></button></div>
        <div className="capture-body"><Image className="capture-orb" src="/assets/thought-space-orb-v2.png" alt="" width={78} height={78} /><div><p className="capture-status">{recording ? t.listening : t.ready}</p><p className="capture-hint">{recording ? t.wordsAppear : t.audioPrivacy}</p></div></div>
        <form onSubmit={saveThought}><textarea autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={t.placeholder} /><div className="capture-actions">{recording ? <button type="button" onClick={stopRecording}>{t.stop}</button> : <button type="button" onClick={startRecording}><Microphone size={16} /> {t.start}</button>}<button className="primary" type="submit">{t.save}</button></div></form>
        {notice && <p className="capture-error">{notice}</p>}
      </aside>}
      {notice && !captureOpen && <p className="toast">{notice}</p>}
    </main>
  );
}