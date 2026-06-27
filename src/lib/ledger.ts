// 去重台账 + 单日计数(localStorage)。键用 encryptJobId(href 兜底)。
const APPLIED_KEY = "qzc.applied.v1";
const DAILY_KEY = "qzc.daily.v1";

export function loadApplied(): Set<string> {
  try {
    const r = localStorage.getItem(APPLIED_KEY);
    if (r) return new Set(JSON.parse(r) as string[]);
  } catch {
    /* ignore */
  }
  return new Set();
}

export function markApplied(id: string): void {
  if (!id) return;
  const s = loadApplied();
  s.add(id);
  localStorage.setItem(APPLIED_KEY, JSON.stringify([...s]));
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** 今日已投数量。 */
export function getDaily(): number {
  try {
    const r = JSON.parse(localStorage.getItem(DAILY_KEY) || "{}");
    return r.date === today() ? r.count || 0 : 0;
  } catch {
    return 0;
  }
}

/** 今日计数 +1,返回新值。 */
export function bumpDaily(): number {
  const c = getDaily() + 1;
  localStorage.setItem(DAILY_KEY, JSON.stringify({ date: today(), count: c }));
  return c;
}

// ===== 投递记录(供飞书同步) =====
export interface ApplyRecord {
  id: string;
  title: string;
  company: string;
  city: string;
  salary: string;
  track: string;
  href: string;
  greeting: string;
  date: number; // ms
  synced: boolean;
}

const RECORDS_KEY = "qzc.records.v1";

export function loadRecords(): ApplyRecord[] {
  try {
    const r = localStorage.getItem(RECORDS_KEY);
    if (r) return JSON.parse(r) as ApplyRecord[];
  } catch {
    /* ignore */
  }
  return [];
}

function saveRecords(rs: ApplyRecord[]) {
  localStorage.setItem(RECORDS_KEY, JSON.stringify(rs));
}

/** 记一条投递(同时计入去重台账)。同 id 已存在则覆盖。 */
export function addRecord(r: ApplyRecord): void {
  markApplied(r.id);
  const rs = loadRecords().filter((x) => x.id !== r.id);
  rs.push(r);
  saveRecords(rs);
}

export function unsyncedRecords(): ApplyRecord[] {
  return loadRecords().filter((r) => !r.synced);
}

export function markSynced(ids: string[]): void {
  const set = new Set(ids);
  saveRecords(loadRecords().map((r) => (set.has(r.id) ? { ...r, synced: true } : r)));
}
