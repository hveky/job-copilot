import { useState } from "react";
import {
  Bot,
  KeyRound,
  Download,
  Send,
  RefreshCw,
  ShieldCheck,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { Button } from "../ui";
import {
  isDesktop,
  openBossWindow,
  bossSearch,
  bossFetchJd,
  bossReplies,
  feishuSync,
  type BossJob,
  type BossReplies,
} from "../lib/tauri";
import { cityCode } from "../data/cities";
import { salaryMatches } from "../data/salaries";
import { ApplyModal } from "./ApplyModal";
import { BatchApplyModal } from "./BatchApplyModal";
import {
  addRecord,
  getDaily,
  loadApplied,
  markSynced,
  unsyncedRecords,
  type ApplyRecord,
} from "../lib/ledger";
import { buildFeishuRecords } from "../lib/feishu";
import type { GatewayConfig } from "../gateway/types";
import { normalizeApplySafety } from "../lib/applySafety";

// BOSS 投递台(Phase B step1-3b):登录 → 抓 JD → 审核后半自动投递(单条/批量)。
export function BossPanel(props: {
  gateway: GatewayConfig;
  job: string;
  city: string;
  salary: string;
  resume: string;
  instruction: string;
  dailyCap: number;
  delayMin: number;
  delayMax: number;
  feishuAppId: string;
  feishuAppSecret: string;
  feishuUserToken: string;
  feishuBaseToken: string;
  feishuTableId: string;
  root: string;
  onPickJd: (jd: string) => void;
  onApplied?: () => void;
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
  const safety = normalizeApplySafety(props);

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

  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState("");

  function handleApplied(rec: ApplyRecord) {
    addRecord(rec);
    setAppliedIds((s) => new Set(s).add(rec.id));
    props.onApplied?.();
  }

  async function syncFeishu() {
    setSyncNote("");
    if (!props.feishuUserToken && (!props.feishuAppId || !props.feishuAppSecret)) {
      setSyncNote("请先在「设置 → 飞书」用账号授权,或填 app_id / app_secret。");
      return;
    }
    const recs = unsyncedRecords();
    if (recs.length === 0) {
      setSyncNote("没有待同步的投递记录。");
      return;
    }
    setSyncing(true);
    try {
      const n = await feishuSync(
        props.feishuAppId,
        props.feishuAppSecret,
        props.feishuUserToken,
        props.feishuBaseToken,
        props.feishuTableId,
        buildFeishuRecords(recs),
      );
      markSynced(recs.map((r) => r.id));
      setSyncNote(`已同步 ${n} 条到飞书多维表格。`);
    } catch (e) {
      setSyncNote("同步失败:" + String(e));
    } finally {
      setSyncing(false);
    }
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
      const raw = await bossSearch(props.job, cityCode(props.city));
      const list = raw.filter((j) => salaryMatches(j.salary, props.salary));
      setJobs(list);
      if (!raw.length) {
        setErr("没抓到岗位卡片(确认 BOSS 窗口已登录且停在搜索页)。");
      } else if (!list.length) {
        setErr(`抓到 ${raw.length} 条,但都不在「${props.salary}」区间。换个薪资档位或选「不限」。`);
      } else if (list.length < raw.length) {
        setErr(`已按薪资「${props.salary}」过滤:${raw.length} → ${list.length} 条。`);
      }
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
        <h3 className="flex items-center gap-2">
          <Bot size={18} strokeWidth={1.75} className="text-accent-strong" />
          BOSS 自动投递 · 桌面版
        </h3>
        <p className="hint" style={{ marginTop: 0 }}>
          此功能仅<strong>桌面版</strong>可用——需要内置浏览器承载 BOSS 登录与自动化。
          当前是网页预览版,请用 <code>npx tauri dev</code> 启动桌面版体验。
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="flex items-center gap-2">
        <Bot size={18} strokeWidth={1.75} className="text-accent-strong" />
        BOSS 自动投递 · 桌面版
      </h3>
      <p className="hint" style={{ marginTop: 0 }}>
        打开内置 BOSS 浏览器扫码登录(登录态记住),再按当前目标岗位
        <strong>「{props.job || "（未选）"}」</strong> + 城市
        <strong>「{props.city}」</strong>抓取在招岗位,点「用这个」把 JD 灌进生成器。
      </p>
      <div className="metrics">
        <div className={"metric" + (getDaily() >= safety.dailyCap ? " warn" : "")}>
          <span className="metric-num">
            {getDaily()}
            <span className="metric-cap">/{safety.dailyCap}</span>
          </span>
          <span className="metric-label">
            今日已投{getDaily() >= safety.dailyCap ? " · 已达上限" : ""}
          </span>
        </div>
        <div className="metric">
          <span className="metric-num">{appliedIds.size}</span>
          <span className="metric-label">累计已投</span>
        </div>
      </div>
      <div className="row" style={{ flexWrap: "wrap" }}>
        <Button
          variant="ghost"
          loading={opening}
          onClick={open}
          icon={<KeyRound size={16} strokeWidth={1.75} />}
        >
          {opening ? "打开中…" : "打开 / 登录 BOSS"}
        </Button>
        <Button
          variant="primary"
          loading={searching}
          onClick={search}
          icon={<Download size={16} strokeWidth={1.75} />}
        >
          {searching ? "抓取中…" : "抓取岗位"}
        </Button>
        {jobs.length > 0 && (
          <Button
            onClick={() => setShowBatch(true)}
            icon={<Send size={16} strokeWidth={1.75} />}
          >
            批量投递({jobs.length})
          </Button>
        )}
        <Button
          variant="ghost"
          loading={refreshing}
          onClick={refreshReplies}
          icon={<RefreshCw size={16} strokeWidth={1.75} />}
        >
          {refreshing ? "刷新中…" : "刷新回复"}
        </Button>
        <Button
          variant="ghost"
          loading={syncing}
          onClick={syncFeishu}
          icon={<RefreshCw size={16} strokeWidth={1.75} />}
        >
          {syncing ? "同步中…" : "同步飞书"}
        </Button>
        <span className="tier-pill inline-flex items-center gap-1">
          <ShieldCheck size={13} strokeWidth={1.75} />
          step 3b · 半自动投递
        </span>
      </div>
      {err && <div className="err">{err}</div>}
      {syncNote && <div className="hint" style={{ marginTop: 6 }}>{syncNote}</div>}

      {replies && (
        <div className="funnel">
          <div className="funnel-cell">
            <span className="funnel-num">{appliedIds.size}</span>
            <span className="hint">累计已投</span>
          </div>
          <div className="funnel-arrow">
            <ArrowRight size={18} strokeWidth={1.75} />
          </div>
          <div className="funnel-cell">
            <span className="funnel-num">{replies.total}</span>
            <span className="hint">已沟通会话</span>
          </div>
          <div className="funnel-arrow">
            <ArrowRight size={18} strokeWidth={1.75} />
          </div>
          <div className="funnel-cell">
            <span className="funnel-num" style={{ color: "var(--accent-strong)" }}>
              {replies.withReply}
            </span>
            <span className="hint">有新回复</span>
          </div>
        </div>
      )}

      {jobs.length > 0 && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          {jobs.map((j, i) => (
            <div key={j.id || i} className="job-row">
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="job-row-title">
                  {j.title || "(无标题)"}
                  {j.salary && <span className="job-row-salary">{j.salary}</span>}
                </div>
                <div className="hint" style={{ marginTop: 2 }}>
                  {[j.company, j.tags].filter(Boolean).join(" · ")}
                </div>
              </div>
              {j.href && (
                <a
                  className="inline-flex items-center justify-center rounded border border-border bg-surface px-2 py-1.5 text-text-2 no-underline hover:border-accent hover:text-accent-strong"
                  href={j.href}
                  target="_blank"
                  rel="noreferrer"
                  title="在浏览器打开原岗位"
                >
                  <ExternalLink size={14} strokeWidth={1.75} />
                </a>
              )}
              <Button
                variant="ghost"
                size="sm"
                disabled={!!fetching}
                onClick={() => pick(j)}
                title="抓 JD 灌进生成器"
              >
                {fetching === (j.id || j.href) ? "抓取中…" : "用这个"}
              </Button>
              <Button
                size="sm"
                onClick={() => setApplyJob(j)}
                icon={<Send size={14} strokeWidth={1.75} />}
                title="生成招呼语 → 审核 → 投递"
              >
                {appliedIds.has(j.id || j.href) ? "再投" : "投递"}
              </Button>
            </div>
          ))}
        </div>
      )}

      {applyJob && (
        <ApplyModal
          gateway={props.gateway}
          jobLabel={props.job}
          city={props.city}
          bossJob={applyJob}
          resume={props.resume}
          instruction={props.instruction}
          root={props.root}
          dailyCap={safety.dailyCap}
          onClose={() => setApplyJob(null)}
          onApplied={handleApplied}
        />
      )}

      {showBatch && (
        <BatchApplyModal
          gateway={props.gateway}
          jobs={jobs}
          jobLabel={props.job}
          city={props.city}
          resume={props.resume}
          instruction={props.instruction}
          dailyCap={safety.dailyCap}
          delayMin={safety.delayMin}
          delayMax={safety.delayMax}
          onClose={() => setShowBatch(false)}
          onApplied={handleApplied}
        />
      )}
    </div>
  );
}
