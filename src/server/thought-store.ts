import { createClient, type Client } from "@libsql/client";
import { randomUUID } from "node:crypto";
import type { ThoughtSource } from "./thought-metadata";

export type AnalysisStatus = "pending" | "complete" | "failed";
export type ThoughtLanguage = "cn" | "en";

export type Thought = {
  id: string;
  ownerId: string;
  transcript: string;
  source: ThoughtSource;
  language: ThoughtLanguage;
  capturedAt: string;
  updatedAt: string;
  summary: string | null;
  tags: string[];
  analysisStatus: AnalysisStatus;
  deletedAt: string | null;
};

export type CreateThoughtInput = Pick<Thought, "transcript" | "source" | "language">;

export type ThoughtStore = {
  create(ownerId: string, input: CreateThoughtInput): Promise<Thought>;
  list(ownerId: string): Promise<Thought[]>;
  softDelete(ownerId: string, id: string): Promise<void>;
  updateTranscript(ownerId: string, id: string, transcript: string): Promise<Thought | null>;
  updateAnalysis(ownerId: string, id: string, analysis: { summary: string | null; tags: string[]; status: AnalysisStatus }): Promise<Thought | null>;
  close(): Promise<void>;
};

type ThoughtRow = {
  id: string;
  owner_id: string;
  transcript: string;
  source: ThoughtSource;
  language: ThoughtLanguage;
  captured_at: string;
  updated_at: string;
  summary: string | null;
  tags: string;
  analysis_status: AnalysisStatus;
  deleted_at: string | null;
};

function toThought(row: ThoughtRow): Thought {
  return {
    id: row.id,
    ownerId: row.owner_id,
    transcript: row.transcript,
    source: row.source,
    language: row.language,
    capturedAt: row.captured_at,
    updatedAt: row.updated_at,
    summary: row.summary,
    tags: JSON.parse(row.tags) as string[],
    analysisStatus: row.analysis_status,
    deletedAt: row.deleted_at,
  };
}

async function initialize(client: Client) {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS thoughts (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      transcript TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'manual',
      language TEXT NOT NULL DEFAULT 'en',
      captured_at TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT '',
      summary TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      analysis_status TEXT NOT NULL DEFAULT 'pending',
      deleted_at TEXT
    )
  `);
  const existing = new Set((await client.execute("PRAGMA table_info(thoughts)")).rows.map((row) => String(row.name)));
  const migrations = [
    ["source", "ALTER TABLE thoughts ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'"],
    ["language", "ALTER TABLE thoughts ADD COLUMN language TEXT NOT NULL DEFAULT 'en'"],
    ["captured_at", "ALTER TABLE thoughts ADD COLUMN captured_at TEXT NOT NULL DEFAULT ''"],
    ["updated_at", "ALTER TABLE thoughts ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''"],
    ["summary", "ALTER TABLE thoughts ADD COLUMN summary TEXT"],
    ["tags", "ALTER TABLE thoughts ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'"],
    ["analysis_status", "ALTER TABLE thoughts ADD COLUMN analysis_status TEXT NOT NULL DEFAULT 'pending'"],
  ] as const;
  for (const [column, sql] of migrations) if (!existing.has(column)) await client.execute(sql);
}

export function createLocalThoughtStore(url: string): ThoughtStore {
  const client = createClient({ url });
  const ready = initialize(client);

  return {
    async create(ownerId, input) {
      await ready;
      const now = new Date().toISOString();
      const thought: Thought = {
        id: randomUUID(),
        ownerId,
        transcript: input.transcript,
        source: input.source,
        language: input.language,
        capturedAt: now,
        updatedAt: now,
        summary: null,
        tags: [],
        analysisStatus: "pending",
        deletedAt: null,
      };

      await client.execute({
        sql: `INSERT INTO thoughts (
          id, owner_id, transcript, source, language, captured_at, updated_at,
          summary, tags, analysis_status, deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          thought.id,
          thought.ownerId,
          thought.transcript,
          thought.source,
          thought.language,
          thought.capturedAt,
          thought.updatedAt,
          thought.summary,
          JSON.stringify(thought.tags),
          thought.analysisStatus,
          thought.deletedAt,
        ],
      });

      return thought;
    },

    async list(ownerId) {
      await ready;
      const result = await client.execute({
        sql: `SELECT * FROM thoughts
              WHERE owner_id = ? AND deleted_at IS NULL
              ORDER BY captured_at DESC`,
        args: [ownerId],
      });
      return result.rows.map((row) => toThought(row as unknown as ThoughtRow));
    },

    async softDelete(ownerId, id) {
      await ready;
      await client.execute({
        sql: "UPDATE thoughts SET deleted_at = ?, updated_at = ? WHERE id = ? AND owner_id = ?",
        args: [new Date().toISOString(), new Date().toISOString(), id, ownerId],
      });
    },

    async updateTranscript(ownerId, id, transcript) {
      await ready;
      await client.execute({ sql: "UPDATE thoughts SET transcript = ?, updated_at = ? WHERE id = ? AND owner_id = ? AND deleted_at IS NULL", args: [transcript, new Date().toISOString(), id, ownerId] });
      return (await this.list(ownerId)).find((thought) => thought.id === id) ?? null;
    },

    async updateAnalysis(ownerId, id, analysis) {
      await ready;
      await client.execute({ sql: "UPDATE thoughts SET summary = ?, tags = ?, analysis_status = ?, updated_at = ? WHERE id = ? AND owner_id = ? AND deleted_at IS NULL", args: [analysis.summary, JSON.stringify(analysis.tags), analysis.status, new Date().toISOString(), id, ownerId] });
      return (await this.list(ownerId)).find((thought) => thought.id === id) ?? null;
    },

    async close() {
      await client.close();
    },
  };
}



