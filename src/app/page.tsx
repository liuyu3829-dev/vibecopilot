"use client";

import Image from "next/image";
import {
  Bell,
  CalendarBlank,
  CaretLeft,
  CaretRight,
  ChartBar,
  MagnifyingGlass,
  Microphone,
  NotePencil,
  Plus,
  Tag,
  Trash,
  Waveform,
} from "@phosphor-icons/react";
import { FormEvent, useEffect, useRef, useState } from "react";

import { closeAudioContext, connectAudioGraph, disconnectAudioGraph, resumeAudioContext, type AudioGraph } from "@/lib/audio-session";
import { encodePcm16, mergeAssemblyTranscript, parseAssemblyMessageType, parseAssemblyTurn, type TranscriptState } from "@/lib/assembly-stream";
import { replaceTranscriptAfterManualEdit, shouldAcceptCaptureMessage } from "@/lib/capture-session";
import { localDateKey } from "@/lib/thought-timeline";
import { splitTranscriptForReading } from "@/lib/transcript-display";
import { desktopHideUrl, desktopLaunchUrl } from "@/desktop/launch";
import { shouldRequireAuth } from "./auth-mode";

type Locale = "zh-CN" | "en";
type Thought = {
  id: string;
  transcript: string;
  language: "cn" | "en";
  capturedAt: string;
  capturedDay: string;
  summary: string | null;
  tags: string[];
  personalTags: string[];
  reportIncluded: boolean;
  analysisStatus: "pending" | "complete" | "failed";
};
type ReportMode = "short_essay" | "post";
type PostLengthPreference = "short" | "adaptive" | "long";
type Report = {
  id: string;
  date: string;
  locale: Locale;
  theme: string;
  narrative: string;
  insights: string[];
  sourceThoughtCount: number;
  generatedAt: string;
  markdown: string;
  mode: ReportMode;
  evidence: Array<{ thoughtId: string; capturedAt: string; transcript: string }>;
};
type Section = "thoughts" | "reports" | "voice" | "tags" | "search" | "settings";
type CaptureStage = "speech_session" | "microphone" | "audio_context" | "streaming";
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
    newThought: "新建想法", listening: "正在聆听…", ready: "准备聆听", start: "开始说话", stop: "停止", save: "保存想法",
    placeholder: "写下一条想法，或直接开始说话…", close: "关闭捕捉", captured: "条想法已记录", today: "今日思想报告",
    generate: "生成报告", empty: "今天的思绪还很安静。", retry: "重试分析", delete: "删除", live: "实时捕捉",
    reportEmpty: "先捕捉一条想法，再发现今天的思绪线索。", locale: "EN", loading: "正在连接你的想法…",
    loadError: "无法加载想法，请刷新后重试。", captureError: "无法访问麦克风或连接实时转写服务。", draftError: "请先说出或写下一条想法。",
    saveError: "无法保存这条想法。", audioPrivacy: "音频仅用于实时转写，不会被保存。", wordsAppear: "文字会随说话实时出现。",
    quoteTitle: "捕捉想法，继续向前。", quote: "在灵感消失前，为它留下一处私密空间。", soon: "这个空间正在准备中。",
    mainTheme: "核心主题", signals: "细小信号", pattern: "看见模式，而非压力", gently: "温柔收集每一个想法",
  },
} as const;

const nav = [NotePencil, ChartBar, Microphone, Tag, MagnifyingGlass] as const;

function calendarDays(month: Date) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstWeekday = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const count = new Date(year, monthIndex + 1, 0).getDate();
  return Array.from({ length: firstWeekday + count }, (_, index) => {
    if (index < firstWeekday) return null;
    const day = index - firstWeekday + 1;
    return localDateKey(new Date(year, monthIndex, day));
  });
}

function ThoughtTranscript({ transcript }: { transcript: string }) {
  const paragraphs = splitTranscriptForReading(transcript);
  const preview = paragraphs.slice(0, 3);
  const remainder = paragraphs.slice(3);
  return <div className="thought-copy">{preview.map((paragraph, index) => <p key={index}>{paragraph}</p>)}{remainder.length > 0 && <details className="thought-expand"><summary>展开全文</summary>{remainder.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</details>}</div>;
}

function SearchCenter({ locale, query, onQueryChange, thoughts, reports }: { locale: Locale; query: string; onQueryChange(value: string): void; thoughts: Thought[]; reports: Report[] }) {
  const hasQuery = Boolean(query.trim());
  const date = (value: string) => new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric" }).format(new Date(`${value}T12:00:00`));
  return <section className="search-center"><p className="eyebrow">{locale === "zh-CN" ? "检索你的记录" : "SEARCH YOUR SPACE"}</p><h2>{locale === "zh-CN" ? "搜索想法与报告" : "Search thoughts and reports"}</h2><label className="search-field"><MagnifyingGlass size={18} /><input type="search" role="searchbox" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder={locale === "zh-CN" ? "输入关键词，例如 AI" : "Search keywords, such as AI"} /></label>{!hasQuery ? <p className="search-empty">{locale === "zh-CN" ? "输入关键词，查找过去的想法和报告。" : "Enter a keyword to find past thoughts and reports."}</p> : <div className="search-results" aria-live="polite"><section><h3>{locale === "zh-CN" ? `想法 · ${thoughts.length}` : `Thoughts · ${thoughts.length}`}</h3>{thoughts.length ? thoughts.map((thought) => <article className="search-thought" key={thought.id}><time>{date(thought.capturedDay)} · {new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(new Date(thought.capturedAt))}</time><ThoughtTranscript transcript={thought.transcript} />{thought.summary && <p className="thought-summary">{thought.summary}</p>}<div className="chips">{thought.personalTags.map((tag) => <span className="personal-tag" key={tag}>{tag}</span>)}</div></article>) : <p className="search-empty">{locale === "zh-CN" ? "没有匹配的想法。" : "No matching thoughts."}</p>}</section><section><h3>{locale === "zh-CN" ? `报告 · ${reports.length}` : `Reports · ${reports.length}`}</h3>{reports.length ? reports.map((report) => <article className="search-report" key={report.id}><header><div><span className="report-language">{report.locale === "zh-CN" ? "中文" : "English"}</span><span className="report-language">{report.mode === "post" ? (locale === "zh-CN" ? "推文" : "Post") : (locale === "zh-CN" ? "短论文" : "Short essay")}</span></div><time>{date(report.date)}</time></header><p>{report.narrative}</p><details><summary>{locale === "zh-CN" ? "阅读全文" : "Read report"}</summary><div className="report-markdown">{report.markdown.split("\n").filter(Boolean).map((line, index) => <p key={index}>{line.replace(/^#+\s*/, "")}</p>)}</div></details></article>) : <p className="search-empty">{locale === "zh-CN" ? "没有匹配的报告。" : "No matching reports."}</p>}</section></div>}</section>;
}

function TagBrowser({ locale, tags, activeTag, onSelect, thoughts }: { locale: Locale; tags: string[]; activeTag: string | null; onSelect(tag: string | null): void; thoughts: Thought[] }) {
  const date = (value: string) => new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric" }).format(new Date(`${value}T12:00:00`));
  const label = activeTag ? (locale === "zh-CN" ? `“${activeTag}” 的想法 · ${thoughts.length}` : `Thoughts tagged “${activeTag}” · ${thoughts.length}`) : (locale === "zh-CN" ? `全部带标签的想法 · ${thoughts.length}` : `All tagged thoughts · ${thoughts.length}`);
  return <section className="tag-browser"><p className="eyebrow">{locale === "zh-CN" ? "个人标签" : "PERSONAL TAGS"}</p><h2>{locale === "zh-CN" ? "按标签查看所有想法" : "Browse all thoughts by tag"}</h2>{tags.length ? <><div className="tag-filter-list"><button className={!activeTag ? "active" : ""} onClick={() => onSelect(null)}>{locale === "zh-CN" ? "全部带标签的想法" : "All tagged thoughts"}</button>{tags.map((tag) => <button key={tag} className={activeTag === tag ? "active" : ""} onClick={() => onSelect(tag)}>{tag}</button>)}</div><div className="tag-thought-list"><p className="tag-result-label">{label}</p>{thoughts.length ? thoughts.map((thought) => <article className="search-thought" key={thought.id}><time>{date(thought.capturedDay)} · {new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(new Date(thought.capturedAt))}</time><ThoughtTranscript transcript={thought.transcript} />{thought.summary && <p className="thought-summary">{thought.summary}</p>}</article>) : <p className="search-empty">{locale === "zh-CN" ? "这个标签暂时没有想法。" : "No thoughts use this tag yet."}</p>}</div></> : <p className="search-empty">{locale === "zh-CN" ? "先在想法卡片中添加标签。" : "Add a personal tag to a thought first."}</p>}</section>;
}

export default function Home() {
  const [locale, setLocale] = useState<Locale>("en");
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);
  const [reportPendingDelete, setReportPendingDelete] = useState<Report | null>(null);
  const [reportLocale, setReportLocale] = useState<Locale>("zh-CN");
  const [reportMode, setReportMode] = useState<ReportMode>("short_essay");
  const [postLength, setPostLength] = useState<PostLengthPreference>("adaptive");
  const [selectedReportDate, setSelectedReportDate] = useState(() => localDateKey(new Date()));
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [reportDates, setReportDates] = useState<Set<string>>(new Set());
  const [captureOpen, setCaptureOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [recording, setRecording] = useState(false);
  const [discardArmed, setDiscardArmed] = useState(false);
  const [voiceCaptured, setVoiceCaptured] = useState(false);
  const [notice, setNotice] = useState("");
  const [section, setSection] = useState<Section>("thoughts");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [tagDrafts, setTagDrafts] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [searchReports, setSearchReports] = useState<Report[]>([]);
  const socket = useRef<WebSocket | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const transcript = useRef<TranscriptState>({ confirmed: "", live: "" });
  const graph = useRef<AudioGraph | null>(null);
  const captureRun = useRef(0);
  const t = text[locale];
  const dayThoughts = thoughts.filter((thought) => thought.capturedDay === selectedReportDate);
  const visibleThoughts = activeTag ? dayThoughts.filter((thought) => thought.personalTags.includes(activeTag)) : dayThoughts;
  const personalTags = [...new Set(thoughts.flatMap((thought) => thought.personalTags))].sort((left, right) => left.localeCompare(right));
  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase();
  const searchThoughts = normalizedSearchQuery ? thoughts.filter((thought) => [thought.transcript, thought.summary ?? "", ...thought.personalTags].some((value) => value.toLocaleLowerCase().includes(normalizedSearchQuery))) : [];
  const matchedReports = normalizedSearchQuery ? searchReports.filter((report) => [report.markdown, report.narrative].some((value) => value.toLocaleLowerCase().includes(normalizedSearchQuery))) : [];
  const taggedThoughts = thoughts.filter((thought) => activeTag ? thought.personalTags.includes(activeTag) : thought.personalTags.length > 0);
  const loadThoughts = async () => {
    try {
      const thoughtResponse = await fetch("/api/thoughts").then((response) => response.json());
      setThoughts(thoughtResponse.data ?? []);
    } catch {
      setNotice(t.loadError);
    }
  };

  const loadReports = async (date = selectedReportDate) => {
    try {
      const response = await fetch(`/api/reports/daily?date=${date}`).then((result) => result.json());
      const items = Array.isArray(response.data) ? response.data as Report[] : [];
      setReports(items);
      setExpandedReportId(items[0]?.id ?? null);
    } catch {
      setNotice(t.loadError);
    }
  };

  const loadReportDates = async () => {
    try {
      const response = await fetch("/api/reports/daily?index=dates").then((result) => result.json());
      setReportDates(new Set(Array.isArray(response.data) ? response.data : []));
    } catch {
      // Calendar markers are optional; the selected date remains usable.
    }
  };

  const load = async () => { await Promise.all([loadThoughts(), loadReports(), loadReportDates()]); };

  useEffect(() => { void loadThoughts(); void loadReportDates(); }, []);
  useEffect(() => { void loadReports(selectedReportDate); }, [selectedReportDate]);
  useEffect(() => {
    if (section !== "search") return;
    void fetch("/api/reports/daily?index=all").then((response) => response.json()).then((response) => setSearchReports(Array.isArray(response.data) ? response.data : [])).catch(() => setNotice(t.loadError));
  }, [section]);
  useEffect(() => () => { stopRecording(); }, []);
  useEffect(() => {
    const refreshTimeline = () => { void loadThoughts(); void loadReportDates(); };
    const refreshWhenVisible = () => { if (document.visibilityState === "visible") refreshTimeline(); };
    const interval = window.setInterval(refreshTimeline, 5000);
    window.addEventListener("focus", refreshTimeline);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshTimeline);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);

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

  const reportCaptureIssue = (stage: CaptureStage) => {
    console.warn("[thought-space][capture]", { stage });
    setNotice(`${t.captureError} (${stage})`);
  };

  const startRecording = async (initialDraft = "") => {
    stopRecording();
    setDiscardArmed(false);
    const run = captureRun.current;
    setNotice("");
    transcript.current = { confirmed: initialDraft, live: "" };
    setDraft(initialDraft);
    let stage: CaptureStage = "audio_context";
    try {
      const context = new AudioContext();
      audio.current = context;
      await resumeAudioContext(context);
      stage = "speech_session";
      const response = await fetch(`/api/speech/session?language=${locale === "zh-CN" ? "cn" : "en"}`);
      const session = await response.json();
      if (!session.data?.url) throw new Error(session.error?.message ?? "Speech unavailable");
      stage = "microphone";
      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (captureRun.current !== run) { mediaStream.getTracks().forEach((track) => track.stop()); return; }
      stage = "streaming";
      const webSocket = new WebSocket(session.data.url);
      stream.current = mediaStream;
      socket.current = webSocket;
      let started = false;
      let failed = false;
      const failStreaming = () => {
        if (failed || socket.current !== webSocket) return;
        failed = true;
        stopRecording();
        reportCaptureIssue("streaming");
      };
      const startAudio = () => {
        if (started || captureRun.current !== run) return;
        started = true;
        graph.current = connectAudioGraph(context, mediaStream, (samples, sampleRate) => {
          if (webSocket.readyState === WebSocket.OPEN) webSocket.send(encodePcm16(samples, sampleRate));
        });
        setVoiceCaptured(true);
        setRecording(true);
      };
      const handshakeTimeout = window.setTimeout(failStreaming, 5000);
      webSocket.onmessage = (event) => {
        if (!shouldAcceptCaptureMessage(captureRun.current, run)) return;
        const messageType = parseAssemblyMessageType(event.data);
        if (messageType === "Error") { window.clearTimeout(handshakeTimeout); failStreaming(); return; }
        if (messageType === "Begin") { window.clearTimeout(handshakeTimeout); startAudio(); return; }
        const expectedLanguage = locale === "zh-CN" ? "cn" : "en";
        transcript.current = mergeAssemblyTranscript(transcript.current, parseAssemblyTurn(event.data), expectedLanguage);
        setDraft(`${transcript.current.confirmed}${transcript.current.live}`);
      };
      webSocket.onerror = failStreaming;
      webSocket.onclose = failStreaming;
      webSocket.onopen = () => {
        if (captureRun.current !== run) { webSocket.close(); mediaStream.getTracks().forEach((track) => track.stop()); void closeAudioContext(context); return; }
      };
    } catch {
      stopRecording();
      reportCaptureIssue(stage);
    }
  };

  const updateDraft = (value: string) => {
    setDiscardArmed(false);
    if (!recording) {
      transcript.current = { confirmed: value, live: "" };
      setDraft(value);
      return;
    }
    const next = replaceTranscriptAfterManualEdit({ run: captureRun.current, transcript: transcript.current }, value);
    captureRun.current = next.run;
    transcript.current = next.transcript;
    setDraft(value);
    stopRecording();
    setNotice(locale === "zh-CN" ? "已保留你的修改。点击开始说话后继续录音。" : "Your edit is kept. Click Start speaking to continue recording.");
  };

  const saveThought = async (event: FormEvent) => {
    event.preventDefault();
    const savedTranscript = draft.trim();
    if (!savedTranscript) { setNotice(t.draftError); return; }
    const response = await fetch("/api/thoughts", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript: savedTranscript, language: locale === "zh-CN" ? "cn" : "en", source: voiceCaptured ? "voice" : "manual" }),
    });
    const result = await response.json().catch(() => null) as { data?: { id: string }; error?: { message?: string } } | null;
    if (!response.ok || !result?.data) { setNotice(result?.error?.message ?? t.saveError); return; }
    stopRecording();
    setDiscardArmed(false);
    setCaptureOpen(false);
    transcript.current = { confirmed: "", live: "" };
    setDraft("");
    setVoiceCaptured(false);
    await fetch(`/api/thoughts/${result.data.id}/analysis`, { method: "POST" });
    await load();
  };

  const closeCapture = () => {
    stopRecording();
    transcript.current = { confirmed: "", live: "" };
    setDraft("");
    setVoiceCaptured(false);
    setDiscardArmed(false);
    setCaptureOpen(false);
  };

  const discardCapture = () => {
    if (!discardArmed) {
      setDiscardArmed(true);
      setNotice(locale === "zh-CN" ? "再次点击确认删除本次未保存记录。" : "Click delete again to discard this unsaved recording.");
      return;
    }
    stopRecording();
    transcript.current = { confirmed: "", live: "" };
    setDraft("");
    setVoiceCaptured(false);
    setDiscardArmed(false);
    setNotice(locale === "zh-CN" ? "已删除本次未保存记录。" : "This unsaved recording was discarded.");
  };

  const removeThought = async (id: string) => {
    await fetch(`/api/thoughts/${id}`, { method: "DELETE" });
    await load();
  };

  const updateThoughtOrganization = async (id: string, input: { reportIncluded?: boolean; personalTags?: string[] }) => {
    const response = await fetch(`/api/thoughts/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
    const result = await response.json().catch(() => null) as { data?: Thought; error?: { message?: string } } | null;
    if (!response.ok || !result?.data) { setNotice(result?.error?.message ?? t.saveError); return; }
    setThoughts((items) => items.map((thought) => thought.id === id ? result.data! : thought));
  };

  const addPersonalTag = async (thought: Thought) => {
    const raw = tagDrafts[thought.id]?.trim();
    if (!raw) return;
    const tag = raw.replace(/^#/, "");
    await updateThoughtOrganization(thought.id, { personalTags: [...thought.personalTags, tag] });
    setTagDrafts((drafts) => ({ ...drafts, [thought.id]: "" }));
  };

  const downloadDesktopPet = () => window.location.assign("/api/desktop/download");

  const controlDesktopPet = async (action: "show" | "hide") => {
    if (action === "hide") {
      const controlSecret = window.localStorage.getItem("thought-space-orb-control") ?? undefined;
      window.location.assign(desktopHideUrl(controlSecret));
      setNotice("");
      return;
    }
    try {
      const response = await fetch("/api/desktop/pair", { method: "POST" });
      const result = await response.json().catch(() => null) as { data?: { ticket?: string; controlSecret?: string }; error?: { message?: string } } | null;
      const ticket = result?.data?.ticket;
      const controlSecret = result?.data?.controlSecret;
      if (!response.ok || !ticket || !controlSecret) throw new Error(result?.error?.message ?? "Unable to pair the desktop orb.");
      window.localStorage.setItem("thought-space-orb-control", controlSecret);
      window.location.assign(desktopLaunchUrl(ticket, controlSecret));
    } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to pair the desktop orb."); }
  };
  const generateReport = async (outputLocale = reportLocale, outputMode = reportMode, outputLength = postLength) => {
    setNotice(t.loading);
    const response = await fetch("/api/reports/daily", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: selectedReportDate, locale: outputLocale, mode: outputMode, lengthPreference: outputLength }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) setNotice(result.error?.message ?? "Report generation failed.");
    else { setNotice(""); await Promise.all([loadReports(selectedReportDate), loadReportDates()]); }
  };
  const confirmDeleteReport = async () => {
    if (!reportPendingDelete) return;
    const report = reportPendingDelete;
    setReportPendingDelete(null);
    const response = await fetch(`/api/reports/daily/${report.id}`, { method: "DELETE" });
    if (!response.ok) { setNotice(locale === "zh-CN" ? "无法删除这份报告。" : "Unable to delete this report."); return; }
    await Promise.all([loadReports(selectedReportDate), loadReportDates()]);
  };
  const migrateLocalData = async () => {
    setNotice("");
    const response = await fetch("/api/migrations/local", { method: "POST" });
    const result = await response.json();
    if (!response.ok) { setNotice(result.error?.message ?? "Local data migration failed."); return; }
    const { thoughts: migratedThoughts, reports: migratedReports } = result.data as { thoughts: number; reports: number };
    setNotice(locale === "zh-CN" ? `已迁移 ${migratedThoughts} 条想法和 ${migratedReports} 份报告。` : `Migrated ${migratedThoughts} thoughts and ${migratedReports} reports.`);
    await load();
  };

  return (
    <main className="thought-space">
      <aside className="rail">
        <div className="brand"><Image src="/assets/thought-space-orb-v2.png" alt="" width={38} height={38} priority /><span>Thought Space</span></div>
        <nav className="nav-list" aria-label="Primary navigation">
          {[
            { id: "thoughts" as const, label: t.thoughts },
            { id: "reports" as const, label: t.reports },
            { id: "voice" as const, label: t.voice },
            { id: "tags" as const, label: t.tags },
            { id: "search" as const, label: t.search },
          ].map(({ id, label }, index) => {
            const Icon = nav[index];
            return <button aria-current={section === id ? "page" : undefined} key={id} onClick={() => setSection(id)}><Icon size={18} /><span>{label}</span></button>;
          })}
          <button aria-current={section === "settings" ? "page" : undefined} onClick={() => setSection("settings")}><CalendarBlank size={18} /><span>{t.settings}</span></button>
        </nav>
        <section className="calendar-card" aria-label="Calendar">
          <div className="calendar-heading"><strong>{new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(calendarMonth)}</strong><span><button aria-label="Previous month" onClick={() => setCalendarMonth((value) => new Date(value.getFullYear(), value.getMonth() - 1, 1))}><CaretLeft size={16} /></button><button aria-label="Next month" onClick={() => setCalendarMonth((value) => new Date(value.getFullYear(), value.getMonth() + 1, 1))}><CaretRight size={16} /></button></span></div>
          <div className="week">{["M", "T", "W", "T", "F", "S", "S"].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div>
          <div className="days">{calendarDays(calendarMonth).map((date, index) => date ? <button className={`${date === localDateKey(new Date()) ? "today " : ""}${date === selectedReportDate ? "selected " : ""}${reportDates.has(date) ? "has-report" : ""}`} key={date} onClick={() => setSelectedReportDate(date)}>{Number(date.slice(-2))}</button> : <span key={`blank-${index}`} />)}</div>
        </section>
        <div className="rail-quote"><Waveform size={24} /><p><strong>{t.quoteTitle}</strong><br />{t.quote}</p></div>
      </aside>

      <section className="timeline-shell">
        <header className="timeline-header">
          <div><h1 className="date-heading">{new Intl.DateTimeFormat(locale, { weekday: "long", month: "long", day: "numeric" }).format(new Date(`${selectedReportDate}T12:00:00`))}</h1><p>{visibleThoughts.length} {t.captured}</p></div>
          <div className="header-actions"><button className="locale" onClick={() => setLocale(locale === "en" ? "zh-CN" : "en")}>{t.locale}</button><button className="new-thought" onClick={() => { setCaptureOpen(true); setNotice(""); }}><Plus size={17} />{t.newThought}</button><button aria-label="Notifications"><Bell size={18} /></button></div>
        </header>
        {section === "search" && <SearchCenter locale={locale} query={searchQuery} onQueryChange={setSearchQuery} thoughts={searchThoughts} reports={matchedReports} />}
        {section === "tags" && <TagBrowser locale={locale} tags={personalTags} activeTag={activeTag} onSelect={setActiveTag} thoughts={taggedThoughts} />}
        {section === "settings" ? <section className="desktop-settings">
          <div className="desktop-settings-heading"><Image src="/assets/thought-space-orb-v3.png" alt="" width={72} height={72} /><div><p className="eyebrow">{locale === "zh-CN" ? "桌面端" : "DESKTOP COMPANION"}</p><h2>{locale === "zh-CN" ? "桌面球" : "Desktop orb"}</h2><p>{locale === "zh-CN" ? "下载、显示或隐藏你的桌面捕捉球。" : "Download, show or hide your desktop capture orb."}</p></div></div>
          <div className="desktop-settings-card"><div><h3>{locale === "zh-CN" ? "安装桌面球" : "Install the desktop orb"}</h3><p>{locale === "zh-CN" ? "下载并安装一次，即可从网页显示或隐藏桌面球。" : "Download and install once, then show or hide the orb from the web."}</p></div><button className="desktop-pet" type="button" onClick={downloadDesktopPet}>{locale === "zh-CN" ? "下载 Windows 版" : "Download for Windows"}</button></div>
          <div className="desktop-settings-card desktop-settings-actions"><div><h3>{locale === "zh-CN" ? "显示状态" : "Visibility"}</h3><p>{locale === "zh-CN" ? "已安装后，可随时快速显示或隐藏桌面球。" : "After installation, show or hide the orb instantly."}</p></div><span><button className="desktop-pet" type="button" onClick={() => void controlDesktopPet("show")}>{locale === "zh-CN" ? "显示桌面球" : "Show orb"}</button><button className="desktop-pet desktop-pet-hide" type="button" onClick={() => void controlDesktopPet("hide")}>{locale === "zh-CN" ? "隐藏桌面球" : "Hide orb"}</button></span></div>
          {shouldRequireAuth() && process.env.NODE_ENV !== "production" && <div className="desktop-settings-card desktop-settings-actions"><div><h3>{locale === "zh-CN" ? "迁移本地数据" : "Migrate local data"}</h3><p>{locale === "zh-CN" ? "将此电脑旧版 SQLite 中的想法和日报复制到当前私密云端空间。本地备份不会删除。" : "Copy thoughts and reports from this computer's previous SQLite database into this private cloud space. Your local backup stays untouched."}</p></div><span><button className="desktop-pet" type="button" onClick={() => void migrateLocalData()}>{locale === "zh-CN" ? "开始迁移" : "Migrate local data"}</button></span></div>}
        </section> : section === "reports" ? <section className="report-center">
          <header className="report-center-header"><div><p className="eyebrow">{locale === "zh-CN" ? "报告中心" : "REPORTS"}</p><h2>{new Intl.DateTimeFormat(locale, { year: "numeric", month: "long", day: "numeric", weekday: "long" }).format(new Date(`${selectedReportDate}T12:00:00`))}</h2><p>{locale === "zh-CN" ? "每一份报告都保留生成时的语言与文字。" : "Each report keeps the language and wording it was generated with."}</p></div></header>
          <div className="report-workspace"><aside className="report-sidebar"><details className="report-source-list"><summary><div className="report-source-heading"><p className="report-label">{locale === "zh-CN" ? "日报素材" : "Source thoughts"}</p><span>{dayThoughts.filter((thought) => thought.reportIncluded).length}/{dayThoughts.length}</span></div></summary>{dayThoughts.length ? <div className="report-source-items">{dayThoughts.map((thought) => <label key={thought.id}><input type="checkbox" checked={thought.reportIncluded} onChange={(event) => void updateThoughtOrganization(thought.id, { reportIncluded: event.target.checked })} /><span><time>{new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(new Date(thought.capturedAt))}</time>{thought.transcript}</span></label>)}</div> : <p className="report-source-empty">{locale === "zh-CN" ? "这一天还没有可选想法。" : "No thoughts are available for this date."}</p>}</details><section className="report-generator"><div><p className="report-label">{locale === "zh-CN" ? "输出语言" : "Output language"}</p><div className="report-mode-switch"><button className={reportLocale === "zh-CN" ? "active" : ""} onClick={() => setReportLocale("zh-CN")}>中文</button><button className={reportLocale === "en" ? "active" : ""} onClick={() => setReportLocale("en")}>English</button></div></div><div><p className="report-label">{locale === "zh-CN" ? "写作方式" : "Writing mode"}</p><div className="report-mode-switch"><button className={reportMode === "short_essay" ? "active" : ""} onClick={() => setReportMode("short_essay")}>{locale === "zh-CN" ? "短论文" : "Short essay"}</button><button className={reportMode === "post" ? "active" : ""} onClick={() => setReportMode("post")}>{locale === "zh-CN" ? "推文" : "Post"}</button></div></div>{reportMode === "post" && <div><p className="report-label">{locale === "zh-CN" ? "推文长度" : "Post length"}</p><div className="report-mode-switch"><button className={postLength === "short" ? "active" : ""} onClick={() => setPostLength("short")}>{locale === "zh-CN" ? "短" : "Short"}</button><button className={postLength === "adaptive" ? "active" : ""} onClick={() => setPostLength("adaptive")}>{locale === "zh-CN" ? "自适应" : "Adaptive"}</button><button className={postLength === "long" ? "active" : ""} onClick={() => setPostLength("long")}>{locale === "zh-CN" ? "长" : "Long"}</button></div></div>}<button className="report-regenerate" onClick={() => void generateReport()}>{locale === "zh-CN" ? "生成日报" : "Generate daily note"}</button></section></aside><section className="report-reading">{reports.length === 0 ? <section className="empty-state report-center-empty"><Image src="/assets/thought-space-orb-v2.png" alt="" width={76} height={76} /><p>{locale === "zh-CN" ? "这一天还没有生成日报。" : "No daily note has been generated for this date."}</p></section> : <div className="report-card-list">{reports.map((item) => { const expanded = expandedReportId === item.id; return <article className={`report-entry ${expanded ? "is-expanded" : ""}`} key={item.id}><header><button className="report-collapse" type="button" onClick={() => setExpandedReportId(expanded ? null : item.id)} aria-expanded={expanded}><span>{expanded ? "▾" : "▸"}</span><div><span className="report-language">{item.locale === "zh-CN" ? "中文" : "English"}</span><span className="report-language">{item.mode === "post" ? (locale === "zh-CN" ? "推文" : "Post") : (locale === "zh-CN" ? "短论文" : "Short essay")}</span><small>{new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(new Date(item.generatedAt))}</small></div><p>{item.narrative}</p></button><span><button className="report-regenerate" onClick={() => { setReportLocale(item.locale); setReportMode(item.mode); void generateReport(item.locale, item.mode); }}>{locale === "zh-CN" ? "重新生成" : "Regenerate"}</button><button className="report-delete" type="button" onClick={() => setReportPendingDelete(item)}>{locale === "zh-CN" ? "删除" : "Delete"}</button></span></header>{expanded && <><article className="report-markdown">{item.markdown.split("\n").map((line, index) => line.startsWith("## ") ? <h4 key={index}>{line.slice(3)}</h4> : line.startsWith("# ") ? null : line ? <p key={index}>{line}</p> : null)}</article><details className="report-evidence"><summary>{locale === "zh-CN" ? "查看依据" : "View sources"}</summary><ol>{item.evidence.map((source) => <li key={source.thoughtId}><time>{new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(new Date(source.capturedAt))}</time><span>{source.transcript}</span></li>)}</ol></details></>}</article>; })}</div>}</section></div>
        </section> : section === "tags" ? <section className="tag-center"><p className="eyebrow">{locale === "zh-CN" ? "个人标签" : "PERSONAL TAGS"}</p><h2>{locale === "zh-CN" ? "按标签整理当天想法" : "Organize this day with tags"}</h2>{personalTags.length ? <div className="tag-filter-list">{personalTags.map((tag) => <button key={tag} className={activeTag === tag ? "active" : ""} onClick={() => { setActiveTag(tag); setSection("thoughts"); }}>{tag}</button>)}</div> : <p>{locale === "zh-CN" ? "先在想法卡片中添加标签。" : "Add a personal tag to a thought first."}</p>}</section> : section !== "thoughts" ? <section className="empty-state"><Waveform size={28} /><h2>{section === "voice" ? t.voice : t.search}</h2><p>{t.soon}</p></section> : <div className="thought-list">
          {visibleThoughts.length === 0 ? <section className="empty-state"><Image src="/assets/thought-space-orb-v2.png" alt="" width={76} height={76} /><p>{t.empty}</p><button onClick={() => setCaptureOpen(true)}>{t.newThought}</button></section> : visibleThoughts.map((thought) => <article className="thought-card" key={thought.id}>
            <time>{new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(new Date(thought.capturedAt))}</time><span className="timeline-dot" />
            <div><ThoughtTranscript transcript={thought.transcript} />{thought.summary && <p className="thought-summary">{thought.summary}</p>}<div className="chips">{thought.personalTags.map((tag) => <span className="personal-tag" key={tag}><button onClick={() => setActiveTag(tag)}>{tag}</button><button aria-label={`${locale === "zh-CN" ? "删除标签" : "Remove tag"} ${tag}`} onClick={() => void updateThoughtOrganization(thought.id, { personalTags: thought.personalTags.filter((item) => item !== tag) })}>×</button></span>)}</div><div className="thought-tag-editor"><input list="personal-tags" value={tagDrafts[thought.id] ?? ""} onChange={(event) => setTagDrafts((drafts) => ({ ...drafts, [thought.id]: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void addPersonalTag(thought); } }} placeholder={locale === "zh-CN" ? "添加标签" : "Add tag"} /><button type="button" onClick={() => void addPersonalTag(thought)}>+</button></div>{thought.analysisStatus === "failed" && <button onClick={() => fetch(`/api/thoughts/${thought.id}/analysis`, { method: "POST" }).then(load)}>{t.retry}</button>}</div>
            <div className="thought-actions"><button aria-label={t.delete} onClick={() => removeThought(thought.id)}><Trash size={16} /></button></div>
          </article>)}
        </div>}
      </section>

      {reportPendingDelete && <div className="report-delete-backdrop" role="presentation"><section className="report-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="report-delete-title"><h2 id="report-delete-title">{locale === "zh-CN" ? "删除这份报告？" : "Delete this report?"}</h2><p>{locale === "zh-CN" ? "这只会删除当前报告，不会删除原始想法或录音素材。" : "This removes only this report, not its original thoughts or voice captures."}</p><div><button type="button" onClick={() => setReportPendingDelete(null)}>{locale === "zh-CN" ? "取消" : "Cancel"}</button><button className="report-delete-confirm" type="button" onClick={() => void confirmDeleteReport()}>{locale === "zh-CN" ? "确认删除" : "Delete report"}</button></div></section></div>}

      {captureOpen && <aside className={`capture-panel ${recording ? "is-recording" : ""}`} aria-label={t.newThought}>
        <button className="capture-close" type="button" onClick={closeCapture} aria-label={t.close}>×</button>
        <div className="capture-body"><Image className="capture-orb" src="/assets/thought-space-orb-v2.png" alt="" width={78} height={78} /><div><p className="capture-status">{recording ? t.listening : t.ready}</p><p className="capture-hint">{recording ? t.wordsAppear : t.audioPrivacy}</p></div></div>
        <form onSubmit={saveThought}><textarea autoFocus value={draft} onChange={(event) => updateDraft(event.target.value)} placeholder={t.placeholder} /><div className="capture-actions">{recording ? <button className="capture-start is-recording" type="button" onClick={stopRecording} aria-label={t.stop}>■ {t.stop}</button> : draft.trim() ? <><button type="button" onClick={() => void startRecording(draft)}><Microphone size={16} /> {locale === "zh-CN" ? "继续说话" : "Continue speaking"}</button><button className="primary" type="submit">{t.save}</button><button className={`capture-discard ${discardArmed ? "armed" : ""}`} type="button" onClick={discardCapture} aria-label={locale === "zh-CN" ? "删除本次未保存记录" : "Discard this unsaved recording"}>{discardArmed ? (locale === "zh-CN" ? "确认删除" : "Discard") : <Trash size={16} />}</button></> : <button className="capture-start" type="button" onClick={() => void startRecording(draft)} aria-label={t.start}><Microphone size={18} /> {t.start}</button>}</div></form>
        {notice && <p className="capture-error">{notice}</p>}
      </aside>}
      {notice && !captureOpen && <p className="toast">{notice}</p>}
      <datalist id="personal-tags">{personalTags.map((tag) => <option key={tag} value={tag} />)}</datalist>
    </main>
  );
}
