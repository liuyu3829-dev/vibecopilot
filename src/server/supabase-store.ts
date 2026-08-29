import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { shanghaiDateKey } from "@/lib/thought-timeline";

import type { DailyReport, ReportInput, ReportStore } from "./report-store";
import type { AnalysisStatus, CreateThoughtInput, Thought, ThoughtStore } from "./thought-store";

type ThoughtRow = { id: string; owner_id: string; transcript: string; source: Thought["source"]; language: Thought["language"]; captured_at: string; captured_day?: string; updated_at: string; summary: string | null; tags: string[]; personal_tags?: string[]; report_included?: boolean; analysis_status: AnalysisStatus; deleted_at: string | null };
type ReportRow = { id: string; owner_id: string; date: string; locale: DailyReport["locale"]; mode: DailyReport["mode"]; markdown: string; theme: string; narrative: string; insights: string[]; evidence?: DailyReport["evidence"]; source_thought_count: number; generated_at: string };

const toThought = (row: ThoughtRow): Thought => ({ id: row.id, ownerId: row.owner_id, transcript: row.transcript, source: row.source, language: row.language, capturedAt: row.captured_at, capturedDay: row.captured_day ?? shanghaiDateKey(row.captured_at), updatedAt: row.updated_at, summary: row.summary, tags: row.tags ?? [], personalTags: row.personal_tags ?? [], reportIncluded: row.report_included ?? true, analysisStatus: row.analysis_status, deletedAt: row.deleted_at });
const reportMode = (value: unknown): DailyReport["mode"] => value === "casual_post" || value === "opinion_post" || value === "post" ? value : "short_essay";
const toReport = (row: ReportRow): DailyReport => ({ id: row.id, ownerId: row.owner_id, date: row.date, locale: row.locale, mode: reportMode(row.mode), markdown: row.markdown ?? row.narrative, theme: row.theme, narrative: row.narrative, insights: row.insights ?? [], evidence: row.evidence ?? [], sourceThoughtCount: row.source_thought_count, generatedAt: row.generated_at });

function fail(error: { message: string } | null) { if (error) throw new Error(error.message); }

export function createSupabaseThoughtStore(client: SupabaseClient): ThoughtStore {
  return {
    async create(ownerId: string, input: CreateThoughtInput) {
      const now = new Date().toISOString();
      const row = { id: randomUUID(), owner_id: ownerId, transcript: input.transcript, source: input.source, language: input.language, captured_at: now, captured_day: shanghaiDateKey(now), updated_at: now, summary: null, tags: [], personal_tags: [], report_included: true, analysis_status: "pending", deleted_at: null };
      const result = await client.from("thoughts").insert(row).select().single(); fail(result.error); return toThought(result.data as ThoughtRow);
    },
    async list(ownerId) {
      const result = await client.from("thoughts").select("*").eq("owner_id", ownerId).is("deleted_at", null).order("captured_at", { ascending: false }); fail(result.error); return (result.data as ThoughtRow[] ?? []).map(toThought);
    },
    async softDelete(ownerId, id) { const now = new Date().toISOString(); const result = await client.from("thoughts").update({ deleted_at: now, updated_at: now }).eq("id", id).eq("owner_id", ownerId); fail(result.error); },
    async updateTranscript(ownerId, id, transcript) { const result = await client.from("thoughts").update({ transcript, updated_at: new Date().toISOString() }).eq("id", id).eq("owner_id", ownerId).is("deleted_at", null).select().maybeSingle(); fail(result.error); return result.data ? toThought(result.data as ThoughtRow) : null; },
    async updateOrganization(ownerId, id, input) { const update: Record<string, unknown> = { updated_at: new Date().toISOString() }; if (input.reportIncluded !== undefined) update.report_included = input.reportIncluded; if (input.personalTags !== undefined) update.personal_tags = [...new Set(input.personalTags.map((tag) => tag.trim().replace(/^#/, "")).filter(Boolean))]; const result = await client.from("thoughts").update(update).eq("id", id).eq("owner_id", ownerId).is("deleted_at", null).select().maybeSingle(); fail(result.error); return result.data ? toThought(result.data as ThoughtRow) : null; },
    async updateAnalysis(ownerId, id, analysis) { const result = await client.from("thoughts").update({ summary: analysis.summary, tags: analysis.tags, analysis_status: analysis.status, updated_at: new Date().toISOString() }).eq("id", id).eq("owner_id", ownerId).is("deleted_at", null).select().maybeSingle(); fail(result.error); return result.data ? toThought(result.data as ThoughtRow) : null; },
    async close() {},
  };
}

export function createSupabaseReportStore(client: SupabaseClient): ReportStore {
  return {
    async get(ownerId, date, locale, mode = "short_essay") { const result = await client.from("daily_reports").select("*").eq("owner_id", ownerId).eq("date", date).eq("locale", locale).eq("mode", mode).maybeSingle(); fail(result.error); return result.data ? toReport(result.data as ReportRow) : null; },
    async list(ownerId) { const result = await client.from("daily_reports").select("*").eq("owner_id", ownerId); fail(result.error); return (result.data as ReportRow[] ?? []).map(toReport); },
    async listForDate(ownerId, date) { const result = await client.from("daily_reports").select("*").eq("owner_id", ownerId).eq("date", date).order("generated_at", { ascending: false }); fail(result.error); return (result.data as ReportRow[] ?? []).map(toReport); },
    async delete(ownerId, id) { const result = await client.from("daily_reports").delete().eq("id", id).eq("owner_id", ownerId); fail(result.error); },
    async save(ownerId, input: ReportInput) { const report: DailyReport = { id: randomUUID(), ownerId, ...input, evidence: input.evidence ?? [], generatedAt: new Date().toISOString() }; const result = await client.from("daily_reports").upsert({ id: report.id, owner_id: ownerId, date: report.date, locale: report.locale, mode: report.mode, markdown: report.markdown, theme: report.theme, narrative: report.narrative, insights: report.insights, evidence: report.evidence, source_thought_count: report.sourceThoughtCount, generated_at: report.generatedAt }, { onConflict: "owner_id,date,locale,mode" }).select().single(); fail(result.error); return toReport(result.data as ReportRow); },
    async close() {},
  };
}
