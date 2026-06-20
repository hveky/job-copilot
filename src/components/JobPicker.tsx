import { useState } from "react";
import { chat, GatewayError } from "../gateway/client";
import type { GatewayConfig } from "../gateway/types";
import { JOB_PRESETS } from "../prompts/tracks";
import { recommendSystem, recommendUser } from "../prompts/templates";
import { CITIES } from "../data/cities";

export function JobPicker(props: {
  gateway: GatewayConfig;
  resume: string;
  targetJobs: string[];
  activeJob: string;
  city: string;
  onJobsChange: (jobs: string[]) => void;
  onActiveChange: (job: string) => void;
  onCityChange: (city: string) => void;
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
  }

  function removeJob(job: string) {
    const next = props.targetJobs.filter((j) => j !== job);
    props.onJobsChange(next);
    if (props.activeJob === job) props.onActiveChange(next[0] ?? "");
  }

  async function recommend() {
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
        .split("\n")
        .map((s) => s.replace(/^[-*\d.、\s]+/, "").trim())
        .filter((s) => s && s.length <= 20)
        .slice(0, 8);
      setRecs(list);
      if (!list.length) setErr("没解析到推荐岗位,换个说法再试。");
    } catch (e) {
      setErr(e instanceof GatewayError ? e.message : String(e));
    } finally {
      setRecing(false);
    }
  }

  const presetSuggest = JOB_PRESETS.map((p) => p.label).filter(
    (l) => !props.targetJobs.includes(l),
  );

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
        <span className="hint">城市</span>
        <select
          style={{ width: 110 }}
          value={props.city}
          onChange={(e) => props.onCityChange(e.target.value)}
        >
          {CITIES.map((c) => (
            <option key={c.code} value={c.label}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {presetSuggest.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <span className="hint">快捷建议:</span>
          <div className="tracks" style={{ marginTop: 6 }}>
            {presetSuggest.map((l) => (
              <span key={l} className="chip chip-add" onClick={() => addJob(l)}>
                + {l}
              </span>
            ))}
          </div>
        </div>
      )}

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
