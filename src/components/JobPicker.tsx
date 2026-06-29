import { BadgeDollarSign, BriefcaseBusiness, MapPin, Plus, SquarePen } from "lucide-react";
import { Button, StatusPill } from "../ui";
import type { GatewayConfig } from "../gateway/types";
import { CITIES } from "../data/cities";
import { SALARY_BRACKETS } from "../data/salaries";
import { useState, type ReactNode } from "react";

const HISTORY_MAX = 12;

export function JobPicker(props: {
  gateway: GatewayConfig;
  resume: string;
  targetJobs: string[];
  activeJob: string;
  jobHistory: string[];
  cities: string[];
  city: string;
  salary: string;
  onJobsChange: (jobs: string[]) => void;
  onActiveChange: (job: string) => void;
  onHistoryChange: (history: string[]) => void;
  onCitiesChange: (cities: string[]) => void;
  onCityChange: (city: string) => void;
  onSalaryChange: (salary: string) => void;
}) {
  void props.gateway;
  void props.resume;
  const [custom, setCustom] = useState("");

  function addJob(job: string) {
    const j = job.trim();
    if (!j) return;
    if (!props.targetJobs.includes(j)) props.onJobsChange([...props.targetJobs, j]);
    props.onActiveChange(j);
    props.onHistoryChange([j, ...props.jobHistory.filter((h) => h !== j)].slice(0, HISTORY_MAX));
  }

  function removeJob(job: string) {
    const next = props.targetJobs.filter((j) => j !== job);
    props.onJobsChange(next);
    if (props.activeJob === job) props.onActiveChange(next[0] ?? "");
  }

  function addCity(label: string) {
    const c = label.trim();
    if (!c) return;
    if (!props.cities.includes(c)) props.onCitiesChange([...props.cities, c]);
    props.onCityChange(c);
  }

  function removeCity(label: string) {
    const next = props.cities.filter((c) => c !== label);
    props.onCitiesChange(next);
    if (props.city === label) props.onCityChange(next[0] ?? "");
  }

  const historySuggest = props.jobHistory.filter((l) => !props.targetJobs.includes(l));
  const cityOptions = CITIES.filter((c) => !props.cities.includes(c.label));

  return (
    <section className="rounded border border-border bg-surface p-[18px] shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <header className="mb-4 flex items-center gap-2">
        <h3 className="m-0 flex flex-1 items-center gap-2 text-[14px] font-bold leading-5 text-text">
          <BriefcaseBusiness size={18} strokeWidth={1.75} className="text-accent-strong" />
          投递设置
        </h3>
        <button type="button" className="ghost small inline-flex h-8 items-center gap-1 text-ai" title="编辑目标">
          <SquarePen size={14} strokeWidth={1.75} />
          编辑目标
        </button>
      </header>

      <div className="space-y-4">
        <FieldRow label="目标岗位">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {props.targetJobs.length === 0 && <span className="hint">先添加目标岗位</span>}
            {props.targetJobs.map((j) => (
              <span key={j} className={"chip" + (j === props.activeJob ? " active" : "")} onClick={() => props.onActiveChange(j)}>
                {j}
                {j === props.activeJob && <StatusPill tone="accent" className="ml-1 border-0 bg-white/20 px-1.5 py-0 text-[10px]">AI</StatusPill>}
                <span className="chip-x" onClick={(e) => { e.stopPropagation(); removeJob(j); }}>×</span>
              </span>
            ))}
          </div>
        </FieldRow>

        <div className="grid grid-cols-[72px_1fr_auto] items-center gap-2">
          <span className="text-[13px] font-semibold text-text-2">新增岗位</span>
          <input
            value={custom}
            placeholder="例如 AI 产品经理"
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                addJob(custom);
                setCustom("");
              }
            }}
          />
          <Button size="sm" onClick={() => { addJob(custom); setCustom(""); }} icon={<Plus size={14} strokeWidth={1.75} />}>
            添加
          </Button>
        </div>

        {historySuggest.length > 0 && (
          <FieldRow label="历史选择">
            <div className="flex flex-wrap gap-2">
              {historySuggest.slice(0, 4).map((l) => (
                <span key={l} className="chip chip-add" onClick={() => addJob(l)}>+ {l}</span>
              ))}
            </div>
          </FieldRow>
        )}

        <FieldRow label={<span className="inline-flex items-center gap-1"><MapPin size={14} strokeWidth={1.75} />城市</span>}>
          <div className="flex flex-wrap items-center gap-2">
            {props.cities.map((c) => (
              <span key={c} className={"chip" + (c === props.city ? " active" : "")} onClick={() => props.onCityChange(c)}>
                {c}
                <span className="chip-x" onClick={(e) => { e.stopPropagation(); removeCity(c); }}>×</span>
              </span>
            ))}
            <select className="h-8 w-[118px] py-1 text-[13px]" value="" onChange={(e) => { if (e.target.value) addCity(e.target.value); }}>
              <option value="">+ 添加城市</option>
              {cityOptions.map((c) => <option key={c.code} value={c.label}>{c.label}</option>)}
            </select>
          </div>
        </FieldRow>

        <FieldRow label={<span className="inline-flex items-center gap-1"><BadgeDollarSign size={14} strokeWidth={1.75} />期望薪资</span>}>
          <select className="h-8 max-w-[120px] py-1 text-[13px]" value={props.salary} onChange={(e) => props.onSalaryChange(e.target.value)} title="按薪资区间过滤搜索结果">
            <option value="">不限</option>
            {SALARY_BRACKETS.map((s) => <option key={s.label} value={s.label}>{s.label}</option>)}
          </select>
        </FieldRow>

        <FieldRow label="更多筛选">
          <div className="flex flex-wrap gap-2">
            <span className="chip cursor-default">工作经验：不限</span>
            <span className="chip cursor-default">学历：不限</span>
          </div>
        </FieldRow>
      </div>
    </section>
  );
}

function FieldRow(props: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[72px_1fr] items-start gap-2">
      <span className="pt-1 text-[13px] font-semibold leading-5 text-text-2">{props.label}</span>
      <div className="min-w-0">{props.children}</div>
    </div>
  );
}

