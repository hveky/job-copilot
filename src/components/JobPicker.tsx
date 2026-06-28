import { BriefcaseBusiness, MapPin, BadgeDollarSign, Plus } from "lucide-react";
import { Button } from "../ui";
import type { GatewayConfig } from "../gateway/types";
import { CITIES } from "../data/cities";
import { SALARY_BRACKETS } from "../data/salaries";
import { useState } from "react";

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
    <div className="card">
      <h3 className="flex items-center gap-2">
        <BriefcaseBusiness size={18} strokeWidth={1.75} className="text-accent-strong" />
        目标岗位
      </h3>

      <div className="tracks">
        {props.targetJobs.length === 0 && <span className="hint">先添加一个目标岗位，再抓取岗位。</span>}
        {props.targetJobs.map((j) => (
          <span key={j} className={"chip" + (j === props.activeJob ? " active" : "")} onClick={() => props.onActiveChange(j)}>
            {j}
            <span className="chip-x" onClick={(e) => { e.stopPropagation(); removeJob(j); }}>×</span>
          </span>
        ))}
        {props.targetJobs.length > 0 && (
          <button className="ghost small" onClick={() => { props.onJobsChange([]); props.onActiveChange(""); }}>
            清空
          </button>
        )}
      </div>

      <div className="row" style={{ marginTop: 10, gap: 8 }}>
        <input
          value={custom}
          placeholder="自定义岗位关键词,如「AI产品经理」"
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
        <div style={{ marginTop: 10 }}>
          <span className="hint">历史选择:</span>
          <div className="tracks" style={{ marginTop: 6 }}>
            {historySuggest.map((l) => (
              <span key={l} className="chip chip-add" onClick={() => addJob(l)}>+ {l}</span>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <div className="row" style={{ gap: 8 }}>
          <span className="hint inline-flex items-center gap-1"><MapPin size={14} strokeWidth={1.75} />城市</span>
          <select style={{ width: 120 }} value="" onChange={(e) => { if (e.target.value) addCity(e.target.value); }}>
            <option value="">+ 添加城市</option>
            {cityOptions.map((c) => <option key={c.code} value={c.label}>{c.label}</option>)}
          </select>
          <span className="hint">点城市设为当前</span>
          <span style={{ flex: 1 }} />
          <span className="hint inline-flex items-center gap-1"><BadgeDollarSign size={14} strokeWidth={1.75} />薪资</span>
          <select style={{ width: 110 }} value={props.salary} onChange={(e) => props.onSalaryChange(e.target.value)} title="按薪资区间过滤搜索结果">
            <option value="">不限</option>
            {SALARY_BRACKETS.map((s) => <option key={s.label} value={s.label}>{s.label}</option>)}
          </select>
        </div>
        <div className="tracks" style={{ marginTop: 8 }}>
          {props.cities.length === 0 && <span className="hint">还没选城市,从上面下拉添加。</span>}
          {props.cities.map((c) => (
            <span key={c} className={"chip" + (c === props.city ? " active" : "")} onClick={() => props.onCityChange(c)}>
              {c}
              <span className="chip-x" onClick={(e) => { e.stopPropagation(); removeCity(c); }}>×</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
