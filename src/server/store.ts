import { isSupabaseMode } from "./identity";
import { createLocalReportStore } from "./report-store";
import { createSupabaseReportStore, createSupabaseThoughtStore } from "./supabase-store";
import { createSupabaseAdminClient } from "./supabase";
import { createLocalThoughtStore } from "./thought-store";

const configuredPath = process.env.THOUGHT_SPACE_LOCAL_DB || ".thought-space.sqlite";
const databaseUrl = configuredPath.startsWith("file:") || configuredPath === ":memory:" ? configuredPath : `file:${configuredPath}`;
const client = isSupabaseMode() ? createSupabaseAdminClient() : null;

export const thoughtStore = client ? createSupabaseThoughtStore(client) : createLocalThoughtStore(databaseUrl);
export const reportStore = client ? createSupabaseReportStore(client) : createLocalReportStore(databaseUrl);
