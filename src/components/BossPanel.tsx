import { useState } from "react";
import {
  isDesktop,
  openBossWindow,
  bossSearch,
  bossFetchJd,
  type BossJob,
} from "../lib/tauri";
import { cityCode } from "../data/cities";

// BOSS 投递台(Phase B step1-2):打开内置 BOSS 浏览器登录 → 按岗位+城市抓 JD。
export function BossPanel(props: {
  job: string;
  city: string;
  onPickJd: (jd: string) => void;
}) {
  const [err, setErr] = useState("");
  const [opening, setOpening] = useState(false);
  const [searching, setSearching] = useState(false);
  const [fetching, setFetching] = useState("");
  const [jobs, setJobs] = useState<BossJob[]>([]);
  const desktop = isDesktop();

  async function open() {
    setErr("");
    setOpening(true);
    try {
      await openBossWindow();
    } catch (e) {
      setErr(String(e));
    } finally {
      setOpening(false);
    }
  }

  async function search() {
    if (!props.job) {
      setErr("请先在「目标岗位」选/加一个岗位。");
      return;
    }
    setErr("");
    setSearching(true);
    setJobs([]);
    try {
      const list = await bossSearch(props.job, cityCode(props.city));
      setJobs(list);
      if (!list.length) setErr("没抓到岗位卡片(确认 BOSS 窗口已登录且停在搜索页)。");
    } catch (e) {
      setErr(String(e));
    } finally {
      setSearching(false);
    }
  }

  async function pick(j: BossJob) {
    setErr("");
    setFetching(j.id || j.href);
    try {
      const detail = await bossFetchJd(j.href);
      if (detail.jd) {
        props.onPickJd(detail.jd);
      } else {
        setErr("详情页没抓到 JD 正文。");
      }
    } catch (e) {
      setErr(String(e));
    } finally {
      setFetching("");
    }
  }

  if (!desktop) {
    return (
      <div className="card">
        <h3>BOSS 自动投递 · 桌面版</h3>
        <p className="hint" style={{ marginTop: 0 }}>
          此功能仅<strong>桌面版</strong>可用——需要内置浏览器承载 BOSS 登录与自动化。
          当前是网页预览版,请用 <code>npx tauri dev</code> 启动桌面版体验。
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3>BOSS 自动投递 · 桌面版</h3>
      <p className="hint" style={{ marginTop: 0 }}>
        打开内置 BOSS 浏览器扫码登录(登录态记住),再按当前目标岗位
        <strong>「{props.job || "（未选）"}」</strong> + 城市
        <strong>「{props.city}」</strong>抓取在招岗位,点「用这个」把 JD 灌进生成器。
      </p>
      <div className="row" style={{ flexWrap: "wrap" }}>
        <button className="ghost" disabled={opening} onClick={open}>
          {opening ? "打开中…" : "打开 / 登录 BOSS"}
        </button>
        <button className="primary" disabled={searching} onClick={search}>
          {searching ? "抓取中…" : "抓取岗位"}
        </button>
        <span className="tier-pill">step 2 · 自动抓 JD</span>
      </div>
      {err && <div className="err">{err}</div>}

      {jobs.length > 0 && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          {jobs.map((j, i) => (
            <div key={j.id || i} className="job-row">
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="job-row-title">
                  {j.title || "(无标题)"}
                  <span className="job-row-salary">{j.salary}</span>
                </div>
                <div className="hint" style={{ marginTop: 2 }}>
                  {[j.company, j.tags].filter(Boolean).join(" · ")}
                </div>
              </div>
              <button
                className="small"
                disabled={!!fetching}
                onClick={() => pick(j)}
              >
                {fetching === (j.id || j.href) ? "抓取中…" : "用这个"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
