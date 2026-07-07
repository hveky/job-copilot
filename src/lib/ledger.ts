// 投递台账:以 SQLite apply_records 为唯一事实源(web 预览退化为 jobStore 的 localStorage 兜底)。
// 去重、单日计数、飞书同步状态均从投递记录派生,不再维护独立的 localStorage 台账——
// 避免两套存储漂移(清 WebView 缓存后去重失效/日限重置)。
import {
  addApplyRecord,
  applyRecordFromLegacy,
  listApplyRecords,
  migrateApplyRecords,
  type ApplyRecordDb,
} from "./jobStore";
import { isSameLocalDay } from "./localDate.ts";

/** 投递记录(组件间传递 + 飞书同步用的旧口径,date 为毫秒时间戳)。 */
export interface ApplyRecord {
  id: string;
  title: string;
  company: string;
  city: string;
  region?: string;
  salary: string;
  track: string;
  direction?: string;
  href: string;
  greeting: string;
  date: number; // ms
  synced: boolean;
}

// 旧版 localStorage 台账键:仅迁移时读取,迁移成功后删除。
const LEGACY_RECORDS_KEY = "qzc.records.v1";
const LEGACY_APPLIED_KEY = "qzc.applied.v1";
const LEGACY_DAILY_KEY = "qzc.daily.v1";

/**
 * 一次性迁移旧 localStorage 台账到记录库,随后删除旧键。幂等:旧键不存在时是空操作。
 * 旧去重集合(qzc.applied.v1)不单独迁移——它只会由 addRecord 顺带写入,记录集是其超集。
 */
export async function migrateLegacyLedger(): Promise<number> {
  let legacy: ApplyRecord[] = [];
  try {
    const raw = localStorage.getItem(LEGACY_RECORDS_KEY);
    if (raw) legacy = JSON.parse(raw) as ApplyRecord[];
  } catch {
    legacy = [];
  }
  const migrated = legacy.length > 0 ? await migrateApplyRecords(legacy) : 0;
  localStorage.removeItem(LEGACY_RECORDS_KEY);
  localStorage.removeItem(LEGACY_APPLIED_KEY);
  localStorage.removeItem(LEGACY_DAILY_KEY);
  return migrated;
}

/** 记一条投递。 */
export async function recordApply(rec: ApplyRecord): Promise<void> {
  await addApplyRecord(applyRecordFromLegacy(rec));
}

/** 去重键集合:已投记录的 id 与 href 的并集(卡片可能只有其一)。 */
export async function getAppliedKeys(): Promise<Set<string>> {
  const rows = await listApplyRecords();
  const keys = new Set<string>();
  for (const r of rows) {
    if (r.id) keys.add(r.id);
    if (r.href) keys.add(r.href);
  }
  return keys;
}

export interface LedgerSummary {
  today: number;
  total: number;
}

/** 今日(本地日历日)已投数 + 累计投递数。 */
export async function ledgerSummary(now = Date.now()): Promise<LedgerSummary> {
  const rows = await listApplyRecords();
  return {
    today: rows.filter((r) => isSameLocalDay(r.appliedAt, now)).length,
    total: rows.length,
  };
}

/** 今日已投数量(本地日历日)。 */
export async function getDailyCount(): Promise<number> {
  return (await ledgerSummary()).today;
}

function dbToLegacy(r: ApplyRecordDb): ApplyRecord {
  return {
    id: r.id,
    title: r.title,
    company: r.company,
    city: r.city,
    region: r.region,
    salary: r.salary,
    track: r.track,
    direction: r.direction,
    href: r.href,
    greeting: r.greeting,
    date: r.appliedAt,
    synced: r.synced,
  };
}

export async function unsyncedRecords(): Promise<ApplyRecord[]> {
  return (await listApplyRecords()).filter((r) => !r.synced).map(dbToLegacy);
}

export async function markSynced(ids: string[]): Promise<void> {
  const set = new Set(ids);
  const rows = await listApplyRecords();
  for (const r of rows) {
    if (set.has(r.id) && !r.synced) {
      await addApplyRecord({ ...r, synced: true });
    }
  }
}
