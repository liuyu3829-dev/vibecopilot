import { createClient, type Client } from "@libsql/client";
import { randomUUID } from "node:crypto";

export type ReportMode = "short_essay" | "post";
export type ReportEvidence = { thoughtId: string; capturedAt: string; transcript: string };

export type DailyReport = {
  id: string;
  ownerId: string;
  date: string;
  locale: "zh-CN" | "en";
  mode: ReportMode;
  markdown: string;
  theme: string;
  narrative: string;
  insights: string[];
  evidence: ReportEvidence[];
  sourceThoughtCount: number;
  generatedAt: string;
};

export type ReportInput = Omit<DailyReport, "id" | "ownerId" | "generatedAt" | "evidence"> & { evidence?: ReportEvidence[] };

export type ReportStore = {
  get(ownerId: string, date: string, locale: DailyReport["locale"], mode?: ReportMode): Promise<DailyReport | null>;
  list(ownerId: string): Promise<DailyReport[]>;
  listForDate(ownerId: string, date: string): Promise<DailyReport[]>;
  delete(ownerId: string, id: string): Promise<void>;
  save(ownerId: string, report: ReportInput): Promise<DailyReport>;
  close(): Promise<void>;
};

function toReport(row: Record<string, unknown>): DailyReport {
  return {
    id: String(row.id), ownerId: String(row.owner_id), date: String(row.date), locale: row.locale as DailyReport["locale"], mode: row.mode === "post" ? "post" : "short_essay",
    markdown: String(row.markdown ?? `# ${String(row.theme)}\n\n${String(row.narrative)}`),
    theme: String(row.theme), narrative: String(row.narrative), insights: JSON.parse(String(row.insights)) as string[], evidence: JSON.parse(String(row.evidence ?? "[]")) as ReportEvidence[],
    sourceThoughtCount: Number(row.source_thought_count), generatedAt: String(row.generated_at),
  };
}

async function initialize(client: Client) {
  await client.execute(`CREATE TABLE IF NOT EXISTS daily_reports (
    id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, date TEXT NOT NULL, locale TEXT NOT NULL,
    mode TEXT NOT NULL DEFAULT 'short_essay', markdown TEXT NOT NULL DEFAULT '',
    theme TEXT NOT NULL, narrative TEXT NOT NULL, insights TEXT NOT NULL,
    evidence TEXT NOT NULL DEFAULT '[]', source_thought_count INTEGER NOT NULL, generated_at TEXT NOT NULL,
    UNIQUE(owner_id, date, locale, mode)
  )`);
  const existing = new Set((await client.execute("PRAGMA table_info(daily_reports)")).rows.map((row) => String(row.name)));
  if (!existing.has("mode")) await client.execute("ALTER TABLE daily_reports ADD COLUMN mode TEXT NOT NULL DEFAULT 'short_essay'");
  if (!existing.has("markdown")) await client.execute("ALTER TABLE daily_reports ADD COLUMN markdown TEXT NOT NULL DEFAULT ''");
  if (!existing.has("evidence")) await client.execute("ALTER TABLE daily_reports ADD COLUMN evidence TEXT NOT NULL DEFAULT '[]'");
}

export function createLocalReportStore(url: string): ReportStore {
  const client = createClient({ url });
  const ready = initialize(client);
  return {
    async get(ownerId, date, locale, mode = "short_essay") {
      await ready;
      const result = await client.execute({ sql: "SELECT * FROM daily_reports WHERE owner_id = ? AND date = ? AND locale = ? AND mode = ?", args: [ownerId, date, locale, mode] });
      return result.rows[0] ? toReport(result.rows[0] as Record<string, unknown>) : null;
    },
    async list(ownerId) {
      await ready;
      const result = await client.execute({ sql: "SELECT * FROM daily_reports WHERE owner_id = ?", args: [ownerId] });
      return result.rows.map((row) => toReport(row as Record<string, unknown>));
    },
    async listForDate(ownerId, date) {
      await ready;
      const result = await client.execute({ sql: "SELECT * FROM daily_reports WHERE owner_id = ? AND date = ? ORDER BY generated_at DESC", args: [ownerId, date] });
      return result.rows.map((row) => toReport(row as Record<string, unknown>));
    },
    async delete(ownerId, id) {
      await ready;
      await client.execute({ sql: "DELETE FROM daily_reports WHERE id = ? AND owner_id = ?", args: [id, ownerId] });
    },
    async save(ownerId, input) {
      await ready;
      const report: DailyReport = { id: randomUUID(), ownerId, ...input, evidence: input.evidence ?? [], generatedAt: new Date().toISOString() };
      await client.execute({ sql: `INSERT INTO daily_reports (id, owner_id, date, locale, mode, markdown, theme, narrative, insights, evidence, source_thought_count, generated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(owner_id, date, locale, mode) DO UPDATE SET id=excluded.id, markdown=excluded.markdown, theme=excluded.theme, narrative=excluded.narrative, insights=excluded.insights, evidence=excluded.evidence, source_thought_count=excluded.source_thought_count, generated_at=excluded.generated_at`,
      args: [report.id, report.ownerId, report.date, report.locale, report.mode, report.markdown, report.theme, report.narrative, JSON.stringify(report.insights), JSON.stringify(report.evidence), report.sourceThoughtCount, report.generatedAt] });
      return report;
    },
    async close() { await client.close(); },
  };
}
