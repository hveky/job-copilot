import type { BossJob } from "./tauri";
import { isDesktop } from "./tauri";
import type { ApplyRecord } from "./ledger";
import { inferDirection, type ScoreStatus } from "./jobScoring";

const CANDIDATE_KEY = "qzc.candidates.v1";
const APPLY_RECORD_KEY = "qzc.applyRecords.dbFallback.v1";

export interface CandidateJob extends BossJob {
  source: "boss" | "inbox";
  path?: string;
  city: string;
  region: string;
  track: string;
  direction: string;
  jd: string;
  score?: number;
  level: string;
  reason: string;
  highlights: string;
  risks: string;
  scoreStatus: ScoreStatus;
  createdAt: number;
  updatedAt: number;
}

export interface ApplyRecordDb {
  id: string;
  company: string;
  title: string;
  appliedAt: number;
  city: string;
  region: string;
  track: string;
  direction: string;
  salary: string;
  href: string;
  greeting: string;
  synced: boolean;
  createdAt: number;
  updatedAt: number;
}

function now() {
  return Date.now();
}

function fnv64(text: string): string {
  let h = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (const ch of text) {
    h ^= BigInt(ch.codePointAt(0) ?? 0);
    h = BigInt.asUintN(64, h * prime);
  }
  return h.toString(16);
}

function stableId(seed: string, prefix: string) {
  return `${prefix}-${fnv64(seed)}`;
}

function readList<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function writeList<T>(key: string, rows: T[]) {
  localStorage.setItem(key, JSON.stringify(rows));
}

async function invokeDb<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}

export function normalizeCandidateJob(
  job: Partial<CandidateJob> & Pick<BossJob, "title" | "company" | "salary" | "href" | "tags">,
  context: {
    source: "boss" | "inbox";
    city: string;
    track: string;
    path?: string;
    jd?: string;
    score?: number;
    reason?: string;
    level?: string;
  },
): CandidateJob {
  const id = job.id || job.href || context.path || stableId(`${job.title}:${job.company}:${job.href}`, "job");
  const createdAt = job.createdAt || now();
  const direction = job.direction || inferDirection(job.title, job.tags);
  return {
    id,
    href: job.href || "",
    title: job.title || "(无标题)",
    salary: job.salary || "",
    company: job.company || "",
    tags: job.tags || "",
    source: context.source,
    path: context.path,
    city: job.city || context.city || "",
    region: job.region || job.area || "",
    track: job.track || context.track || "",
    direction,
    jd: job.jd || context.jd || "",
    score: typeof job.score === "number" ? job.score : context.score,
    level: job.level || context.level || "",
    reason: job.reason || context.reason || "",
    highlights: job.highlights || "",
    risks: job.risks || "",
    scoreStatus: job.scoreStatus || (typeof job.score === "number" || typeof context.score === "number" ? "scored" : "pending"),
    createdAt,
    updatedAt: now(),
  };
}

export async function upsertCandidateJobs(jobs: CandidateJob[]): Promise<CandidateJob[]> {
  if (isDesktop()) {
    return invokeDb<CandidateJob[]>("db_upsert_candidate_jobs", { jobs });
  }
  const existing = readList<CandidateJob>(CANDIDATE_KEY);
  const map = new Map(existing.map((j) => [j.id, j]));
  for (const job of jobs) {
    map.set(job.id, { ...map.get(job.id), ...job, updatedAt: now() });
  }
  const rows = [...map.values()].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 300);
  writeList(CANDIDATE_KEY, rows);
  return jobs.map((j) => map.get(j.id) || j);
}

export async function listCandidateJobs(): Promise<CandidateJob[]> {
  if (isDesktop()) return invokeDb<CandidateJob[]>("db_list_candidate_jobs");
  return readList<CandidateJob>(CANDIDATE_KEY);
}

export async function updateCandidateScore(
  id: string,
  patch: {
    score: number;
    level: string;
    reason: string;
    highlights: string;
    risks: string;
    scoreStatus: ScoreStatus;
  },
): Promise<CandidateJob> {
  if (isDesktop()) {
    return invokeDb<CandidateJob>("db_update_candidate_score", { id, ...patch });
  }
  const rows = readList<CandidateJob>(CANDIDATE_KEY);
  const next = rows.map((j) => (j.id === id ? { ...j, ...patch, updatedAt: now() } : j));
  writeList(CANDIDATE_KEY, next);
  return next.find((j) => j.id === id) as CandidateJob;
}

export async function updateCandidateJd(id: string, jd: string): Promise<CandidateJob> {
  if (isDesktop()) return invokeDb<CandidateJob>("db_update_candidate_jd", { id, jd });
  const rows = readList<CandidateJob>(CANDIDATE_KEY);
  const next = rows.map((j) => (j.id === id ? { ...j, jd, updatedAt: now() } : j));
  writeList(CANDIDATE_KEY, next);
  return next.find((j) => j.id === id) as CandidateJob;
}

export function applyRecordFromLegacy(record: ApplyRecord): ApplyRecordDb {
  const extended = record as ApplyRecord & { region?: string; direction?: string };
  const appliedAt = record.date || now();
  return {
    id: record.id || stableId(`${record.title}:${record.company}:${record.href}`, "apply"),
    company: record.company || "",
    title: record.title || "",
    appliedAt,
    city: record.city || "",
    region: extended.region || "",
    track: record.track || "",
    direction: extended.direction || inferDirection(record.title, record.track),
    salary: record.salary || "",
    href: record.href || "",
    greeting: record.greeting || "",
    synced: record.synced === true,
    createdAt: appliedAt,
    updatedAt: now(),
  };
}

export async function addApplyRecord(record: ApplyRecordDb): Promise<ApplyRecordDb> {
  if (isDesktop()) return invokeDb<ApplyRecordDb>("db_add_apply_record", { record });
  const rows = readList<ApplyRecordDb>(APPLY_RECORD_KEY).filter((r) => r.id !== record.id);
  rows.unshift({ ...record, updatedAt: now() });
  writeList(APPLY_RECORD_KEY, rows);
  return record;
}

export async function listApplyRecords(): Promise<ApplyRecordDb[]> {
  if (isDesktop()) return invokeDb<ApplyRecordDb[]>("db_list_apply_records");
  return readList<ApplyRecordDb>(APPLY_RECORD_KEY);
}

export async function migrateApplyRecords(records: ApplyRecord[]): Promise<number> {
  const normalized = records.map(applyRecordFromLegacy);
  if (normalized.length === 0) return 0;
  if (isDesktop()) return invokeDb<number>("db_migrate_apply_records", { records: normalized });
  const current = readList<ApplyRecordDb>(APPLY_RECORD_KEY);
  const map = new Map(current.map((r) => [r.id, r]));
  normalized.forEach((r) => map.set(r.id, { ...map.get(r.id), ...r }));
  writeList(APPLY_RECORD_KEY, [...map.values()]);
  return normalized.length;
}
