// 本地时区日期工具。「按天」的逻辑(单日投递上限等)必须按本地日历日,
// 不能用 toISOString(UTC):否则日限窗口在北京时间早上 8 点才切换。
export function localDateKey(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function isSameLocalDay(a: number, b: number): boolean {
  return localDateKey(a) === localDateKey(b);
}
