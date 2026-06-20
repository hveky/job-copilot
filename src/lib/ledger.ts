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
