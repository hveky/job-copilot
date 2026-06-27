import { useState } from "react";
import { chat, GatewayError } from "../gateway/client";
import type { GatewayConfig } from "../gateway/types";
import { recommendSystem, recommendUser } from "../prompts/templates";
import { CITIES } from "../data/cities";
import { SALARY_BRACKETS } from "../data/salaries";

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
  const [custom, setCustom] = useState("");
  const [wish, setWish] = useState("");
  const [recs, setRecs] = useState<string[]>([]);
  const [recing, setRecing] = useState(false);
  const [err, setErr] = useState("");

  function addJob(job: string) {
    const j = job.trim();
    if (!j) return;
    if (!props.targetJobs.includes(j)) {
      props.onJobsChange([...props.targetJobs, j]);
    }
    props.onActiveChange(j);
    // 记入历史(最近优先、去重、限长)
    const hist = [j, ...props.jobHistory.filter((h) => h !== j)].slice(0, HISTORY_MAX);
    props.onHistoryChange(hist);
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

  async function recommend() {
    if (!props.resume.trim() && !wish.trim()) {
      setErr("先填简历(首次启动会引导,或在「文件」面板编辑 resumes),或在上面输入你想投的方向。");
      return;
    }
    setErr("");
    setRecing(true);
    setRecs([]);
    try {
      const out = await chat(props.gateway, {
        tier: "light",
        system: recommendSystem(),
        messages: [
          { role: "user", content: recommendUser({ resume: props.resume, wish }) },
        ],
        maxTokens: 400,
      });
      const list = out
        .split(/[\n、,，]/)
        .map((s) => s.replace(/^[-*\d.\s]+/, "").trim())
        .filter((s) => s && s.length <= 30)
        .slice(0, 8);
      setRecs(list);
      if (!list.length) setErr("没解析到推荐岗位,换个说法或补充简历再试。");
    } catch (e) {
      setErr(e instanceof GatewayError ? e.message : String(e));
    } finally {
      setRecing(false);
    }
  }

  const historySuggest = props.jobHistory.filter(
    (l) => !props.targetJobs.includes(l),
  );
  const cityOptions = CITIES.filter((c) => !props.cities.includes(c.label));

  return (
    <div className="card">
      <h3>① 目标岗位</h3>

      <div className="tracks">
        {props.targetJobs.length === 0 && (
          <span className="hint">还没有目标岗位,下面添加或让 AI 荐岗。</span>
        )}
        {props.targetJobs.map((j) => (
          <span
            key={j}
            className={"chip" + (j === props.activeJob ? " active" : "")}
            onClick={() => props.onActiveChange(j)}
          >
            {j}
            <span
              className="chip-x"
              onClick={(e) => {
                e.stopPropagation();
                removeJob(j);
              }}
            >
              ×
            </span>
          </span>
        ))}
        {props.targetJobs.length > 0 && (
          <button
            className="ghost small"
            onClick={() => {
              props.onJobsChange([]);
              props.onActiveChange("");
            }}
          >
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
        <button
          className="small"
          onClick={() => {
            addJob(custom);
            setCustom("");
          }}
        >
          添加
        </button>
      </div>

      {historySuggest.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <span className="hint">历史选择:</span>
          <div className="tracks" style={{ marginTop: 6 }}>
            {historySuggest.map((l) => (
              <span key={l} className="chip chip-add" onClick={() => addJob(l)}>
                + {l}
              </span>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <div className="row" style={{ gap: 8 }}>
          <span className="hint">城市</span>
          <select
            style={{ width: 120 }}
            value=""
            onChange={(e) => {
              if (e.target.value) addCity(e.target.value);
            }}
          >
            <option value="">+ 添加城市</option>
            {cityOptions.map((c) => (
              <option key={c.code} value={c.label}>
                {c.label}
              </option>
            ))}
          </select>
          <span className="hint">点城市设为当前(用于搜索)</span>
          <span style={{ flex: 1 }} />
          <span className="hint">薪资</span>
          <select
            style={{ width: 110 }}
            value={props.salary}
            onChange={(e) => props.onSalaryChange(e.target.value)}
            title="按薪资区间过滤搜索结果"
          >
            <option value="">不限</option>
            {SALARY_BRACKETS.map((s) => (
              <option key={s.label} value={s.label}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="tracks" style={{ marginTop: 6 }}>
          {props.cities.length === 0 && (
            <span className="hint">还没选城市,从上面下拉添加。</span>
          )}
          {props.cities.map((c) => (
            <span
              key={c}
              className={"chip" + (c === props.city ? " active" : "")}
              onClick={() => props.onCityChange(c)}
            >
              {c}
              <span
                className="chip-x"
                onClick={(e) => {
                  e.stopPropagation();
                  removeCity(c);
                }}
              >
                ×
              </span>
            </span>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
        <div className="row" style={{ gap: 8 }}>
          <input
            value={wish}
            placeholder="想投什么也可以直接说(可空,AI 据简历推荐)"
            onChange={(e) => setWish(e.target.value)}
          />
          <button className="small" disabled={recing} onClick={recommend}>
            {recing ? "推荐中…" : "AI 荐岗"}
          </button>
        </div>
        {recs.length > 0 && (
          <div className="tracks" style={{ marginTop: 8 }}>
            {recs.map((r) => (
              <span key={r} className="chip chip-add" onClick={() => addJob(r)}>
                + {r}
              </span>
            ))}
          </div>
        )}
        {err && <div className="err">{err}</div>}
      </div>
    </div>
  );
}
