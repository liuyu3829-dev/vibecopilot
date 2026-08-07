import { createClient, type Client } from "@libsql/client";
import { randomUUID } from "node:crypto";

export type DailyReport = {
  id: string;
  ownerId: string;
  date: string;
  locale: "zh-CN" | "en";
  theme: string;
  narrative: string;
  insights: string[];
  sourceThoughtCount: number;
  generatedAt: string;
};

export type ReportInput = Omit<DailyReport, "id" | "ownerId" | "generatedAt">;

export type ReportStore = {
  get(ownerId: string, date: string, locale: DailyReport["locale"]): Promise<DailyReport | null>;
  list(ownerId: string): Promise<DailyReport[]>;
  save(ownerId: string, report: ReportInput): Promise<DailyReport>;
  close(): Promise<void>;
};

function toReport(row: Record<string, unknown>): DailyReport {
  return {
    id: String(row.id), ownerId: String(row.owner_id), date: String(row.date), locale: row.locale as DailyReport["locale"],
    theme: String(row.theme), narrative: String(row.narrative), insights: JSON.parse(String(row.insights)) as string[],
    sourceThoughtCount: Number(row.source_thought_count), generatedAt: String(row.generated_at),
  };
}

async function initialize(client: Client) {
  await client.execute(`CREATE TABLE IF NOT EXISTS daily_reports (
    id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, date TEXT NOT NULL, locale TEXT NOT NULL,
    theme TEXT NOT NULL, narrative TEXT NOT NULL, insights TEXT NOT NULL,
    source_thought_count INTEGER NOT NULL, generated_at TEXT NOT NULL,
    UNIQUE(owner_id, date, locale)
  )`);
}

export function createLocalReportStore(url: string): ReportStore {
  const client = createClient({ url });
  const ready = initialize(client);
  return {
    async get(ownerId, date, locale) {
      await ready;
      const result = await client.execute({ sql: "SELECT * FROM daily_reports WHERE owner_id = ? AND date = ? AND locale = ?", args: [ownerId, date, locale] });
      return result.rows[0] ? toReport(result.rows[0] as Record<string, unknown>) : null;
    },
    async list(ownerId) {
      await ready;
      const result = await client.execute({ sql: "SELECT * FROM daily_reports WHERE owner_id = ?", args: [ownerId] });
      return result.rows.map((row) => toReport(row as Record<string, unknown>));
    },
    async save(ownerId, input) {
      await ready;
      const report: DailyReport = { id: randomUUID(), ownerId, ...input, generatedAt: new Date().toISOString() };
      await client.execute({ sql: `INSERT INTO daily_reports (id, owner_id, date, locale, theme, narrative, insights, source_thought_count, generated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(owner_id, date, locale) DO UPDATE SET id=excluded.id, theme=excluded.theme, narrative=excluded.narrative, insights=excluded.insights, source_thought_count=excluded.source_thought_count, generated_at=excluded.generated_at`,
      args: [report.id, report.ownerId, report.date, report.locale, report.theme, report.narrative, JSON.stringify(report.insights), report.sourceThoughtCount, report.generatedAt] });
      return report;
    },
    async close() { await client.close(); },
  };
}
