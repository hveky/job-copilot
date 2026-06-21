import { useState } from "react";
import {
  isDesktop,
  openBossWindow,
  bossSearch,
  bossFetchJd,
  bossReplies,
  type BossJob,
  type BossReplies,
} from "../lib/tauri";
import { cityCode } from "../data/cities";
import { ApplyModal } from "./ApplyModal";
import { BatchApplyModal } from "./BatchApplyModal";
import { getDaily, loadApplied, markApplied } from "../lib/ledger";
import type { GatewayConfig } from "../gateway/types";

// BOSS 投递台(Phase B step1-3b):登录 → 抓 JD → 审核后半自动投递(单条/批量)。
export function BossPanel(props: {
  gateway: GatewayConfig;
  job: string;
  city: string;
  resume: string;
  instruction: string;
  dailyCap: number;
  delayMin: number;
  delayMax: number;
  onPickJd: (jd: string) => void;
}) {
  const [err, setErr] = useState("");
  const [opening, setOpening] = useState(false);
  const [searching, setSearching] = useState(false);
  const [fetching, setFetching] = useState("");
  const [jobs, setJobs] = useState<BossJob[]>([]);
  const [applyJob, setApplyJob] = useState<BossJob | null>(null);
  const [showBatch, setShowBatch] = useState(false);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(() => loadApplied());
  const [replies, setReplies] = useState<BossReplies | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const desktop = isDesktop();

  async function refreshReplies() {
    setErr("");
    setRefreshing(true);
    try {
      setReplies(await bossReplies());
    } catch (e) {
      setErr(String(e));
    } finally {
      setRefreshing(false);
    }
  }

  function handleApplied(id: string) {
    markApplied(id);
    setAppliedIds((s) => new Set(s).add(id));
  }

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
      <div className="metrics">
        <div className={"metric" + (getDaily() >= props.dailyCap ? " warn" : "")}>
          <span className="metric-num">
            {getDaily()}
            <span className="metric-cap">/{props.dailyCap}</span>
          </span>
          <span className="metric-label">
            今日已投{getDaily() >= props.dailyCap ? " · 已达上限" : ""}
          </span>
        </div>
        <div className="metric">
          <span className="metric-num">{appliedIds.size}</span>
          <span className="metric-label">累计已投</span>
        </div>
      </div>
      <div className="row" style={{ flexWrap: "wrap" }}>
        <button className="ghost" disabled={opening} onClick={open}>
          {opening ? "打开中…" : "打开 / 登录 BOSS"}
        </button>
        <button className="primary" disabled={searching} onClick={search}>
          {searching ? "抓取中…" : "抓取岗位"}
        </button>
        {jobs.length > 0 && (
          <button onClick={() => setShowBatch(true)}>
            批量投递({jobs.length})
          </button>
        )}
        <button className="ghost" disabled={refreshing} onClick={refreshReplies}>
          {refreshing ? "刷新中…" : "刷新回复"}
        </button>
        <span className="tier-pill">step 3b · 半自动投递</span>
      </div>
      {err && <div className="err">{err}</div>}

      {replies && (
        <div className="funnel">
          <div className="funnel-cell">
            <span className="funnel-num">{appliedIds.size}</span>
            <span className="hint">累计已投</span>
          </div>
          <div className="funnel-arrow">→</div>
          <div className="funnel-cell">
            <span className="funnel-num">{replies.total}</span>
            <span className="hint">已沟通会话</span>
          </div>
          <div className="funnel-arrow">→</div>
          <div className="funnel-cell">
            <span className="funnel-num">{replies.withReply}</span>
            <span className="hint">有新回复</span>
          </div>
          <div className="funnel-arrow">=</div>
          <div className="funnel-cell">
            <span className="funnel-num" style={{ color: "var(--accent-strong)" }}>
              {replies.total
                ? Math.round((replies.withReply / replies.total) * 100)
                : 0}
              %
            </span>
            <span className="hint">回复率</span>
          </div>
        </div>
      )}

      {jobs.length > 0 && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          {jobs.map((j, i) => (
            <div key={j.id || i} className="job-row">
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="job-row-title">{j.title || "(无标题)"}</div>
                <div className="hint" style={{ marginTop: 2 }}>
                  {[j.company, j.tags].filter(Boolean).join(" · ")}
                </div>
              </div>
              <button
                className="small ghost"
                disabled={!!fetching}
                onClick={() => pick(j)}
                title="抓 JD 灌进生成器"
              >
                {fetching === (j.id || j.href) ? "抓取中…" : "用这个"}
              </button>
              <button
                className="small"
                onClick={() => setApplyJob(j)}
                title="生成招呼语 → 审核 → 投递"
              >
                {appliedIds.has(j.id || j.href) ? "已投 ·再投" : "投递"}
              </button>
            </div>
          ))}
        </div>
      )}

      {applyJob && (
        <ApplyModal
          gateway={props.gateway}
          jobLabel={props.job}
          bossJob={applyJob}
          resume={props.resume}
          instruction={props.instruction}
          onClose={() => setApplyJob(null)}
          onApplied={handleApplied}
        />
      )}

      {showBatch && (
        <BatchApplyModal
          gateway={props.gateway}
          jobs={jobs}
          jobLabel={props.job}
          resume={props.resume}
          instruction={props.instruction}
          dailyCap={props.dailyCap}
          delayMin={props.delayMin}
          delayMax={props.delayMax}
          onClose={() => setShowBatch(false)}
          onAppliedId={handleApplied}
        />
      )}
    </div>
  );
}
