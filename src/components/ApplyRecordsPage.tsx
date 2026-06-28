import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Search, ExternalLink } from "lucide-react";
import { Button } from "../ui";
import { loadRecords } from "../lib/ledger";
import { listApplyRecords, migrateApplyRecords, type ApplyRecordDb } from "../lib/jobStore";

type Filters = {
  company: string;
  title: string;
  appliedAt: string;
  city: string;
  region: string;
  track: string;
  direction: string;
  salary: string;
  href: string;
};

const EMPTY_FILTERS: Filters = {
  company: "",
  title: "",
  appliedAt: "",
  city: "",
  region: "",
  track: "",
  direction: "",
  salary: "",
  href: "",
};

function formatDate(ms: number) {
  if (!ms) return "-";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function includes(value: string, query: string) {
  return !query.trim() || value.toLowerCase().includes(query.trim().toLowerCase());
}

export function ApplyRecordsPage() {
  const [records, setRecords] = useState<ApplyRecordDb[]>([]);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function refresh() {
    setLoading(true);
    setErr("");
    try {
      await migrateApplyRecords(loadRecords());
      setRecords(await listApplyRecords());
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const filtered = useMemo(() => {
    return records.filter((r) => {
      return (
        includes(r.company, filters.company) &&
        includes(r.title, filters.title) &&
        includes(formatDate(r.appliedAt), filters.appliedAt) &&
        includes(r.city, filters.city) &&
        includes(r.region, filters.region) &&
        includes(r.track, filters.track) &&
        includes(r.direction, filters.direction) &&
        includes(r.salary, filters.salary) &&
        includes(r.href, filters.href)
      );
    });
  }, [records, filters]);

  const field = (key: keyof Filters, label: string) => (
    <label className="grid gap-1 text-[12px] font-medium text-text-2">
      {label}
      <input
        className="h-9"
        value={filters[key]}
        placeholder={`筛选${label}`}
        onChange={(e) => setFilters((cur) => ({ ...cur, [key]: e.target.value }))}
      />
    </label>
  );

  return (
    <section className="overflow-hidden rounded border border-border bg-surface shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0 flex-1">
          <h2 className="m-0 text-[16px] font-bold leading-6 text-text">投递记录</h2>
          <p className="m-0 text-[12px] leading-5 text-text-2">本地 SQLite 记录投递公司、岗位、日期、城市、区域、赛道、方向、薪资和岗位链接。</p>
        </div>
        <Button variant="secondary" size="sm" loading={loading} onClick={refresh} icon={<RefreshCw size={15} strokeWidth={1.75} />}>刷新</Button>
      </header>

      <div className="border-b border-border bg-[#F8FAFC] p-4">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
          {field("company", "公司")}
          {field("title", "岗位")}
          {field("appliedAt", "投递日期")}
          {field("city", "城市")}
          {field("region", "区域")}
          {field("track", "赛道")}
          {field("direction", "方向")}
          {field("salary", "薪资")}
          {field("href", "岗位链接")}
          <div className="flex items-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>清空筛选</Button>
          </div>
        </div>
      </div>

      {err && <div className="mx-5 mt-4 rounded border border-[color-mix(in_srgb,var(--danger)_25%,transparent)] bg-danger-soft px-3 py-2 text-[13px] text-danger">{err}</div>}

      <div className="overflow-auto p-5">
        <table className="w-full min-w-[1040px] border-separate border-spacing-0 overflow-hidden rounded border border-border text-left">
          <thead>
            <tr className="h-10 bg-[#F8FAFC] text-[12px] font-semibold text-[#475569]">
              <th className="border-b border-border px-3">公司</th>
              <th className="border-b border-border px-3">岗位</th>
              <th className="border-b border-border px-3">投递日期</th>
              <th className="border-b border-border px-3">城市</th>
              <th className="border-b border-border px-3">区域</th>
              <th className="border-b border-border px-3">赛道</th>
              <th className="border-b border-border px-3">方向</th>
              <th className="border-b border-border px-3">薪资</th>
              <th className="w-20 border-b border-border px-3">链接</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="h-[220px] border-b border-border px-4 text-center text-text-2">
                  <div className="flex flex-col items-center gap-2">
                    <Search size={28} strokeWidth={1.75} className="text-muted" />
                    <strong className="text-text">暂无匹配记录</strong>
                    <span className="text-[12px]">投递成功后会自动写入本地记录库。</span>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="h-12 text-[13px] text-text hover:bg-[#FBFCFE]">
                  <td className="border-b border-border px-3">{r.company || "-"}</td>
                  <td className="border-b border-border px-3 font-medium">{r.title || "-"}</td>
                  <td className="border-b border-border px-3">{formatDate(r.appliedAt)}</td>
                  <td className="border-b border-border px-3">{r.city || "-"}</td>
                  <td className="border-b border-border px-3">{r.region || "-"}</td>
                  <td className="border-b border-border px-3">{r.track || "-"}</td>
                  <td className="border-b border-border px-3">{r.direction || "-"}</td>
                  <td className="border-b border-border px-3">{r.salary || "-"}</td>
                  <td className="border-b border-border px-3">
                    {r.href ? (
                      <a className="inline-flex h-8 w-8 items-center justify-center rounded border border-border text-text-2 hover:border-accent hover:text-accent-strong" href={r.href} target="_blank" rel="noreferrer" title="打开岗位">
                        <ExternalLink size={15} strokeWidth={1.75} />
                      </a>
                    ) : "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
