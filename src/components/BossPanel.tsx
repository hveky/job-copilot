import { useEffect, useMemo, useState } from "react";
import {
  Bot,
  KeyRound,
  Download,
  Send,
  RefreshCw,
  ShieldCheck,
  ArrowRight,
  ExternalLink,
  FileText,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Lightbulb,
} from "lucide-react";
import { Button } from "../ui";
import {
  isDesktop,
  openBossWindow,
  bossSearch,
  bossFetchJd,
  bossReplies,
  feishuSync,
  fsList,
  fsRead,
  fsWrite,
  type BossJob,
  type BossReplies,
} from "../lib/tauri";
import { cityCode } from "../data/cities";
import { salaryMatches } from "../data/salaries";
import { ApplyModal } from "./ApplyModal";
import { BatchApplyModal } from "./BatchApplyModal";
import { WorkflowRail, type WorkflowStep } from "./WorkflowRail";
import { addRecord, getDaily, loadApplied, markSynced, unsyncedRecords, type ApplyRecord } from "../lib/ledger";
import { buildFeishuRecords } from "../lib/feishu";
import type { GatewayConfig, Tier } from "../gateway/types";
import { chat, GatewayError } from "../gateway/client";
import { contentPackSystem, contentPackUser } from "../prompts/templates";
import { normalizeApplySafety } from "../lib/applySafety";
import type { ApplyTaskStatus, ContentTaskStatus } from "./TaskStatusBar";

const META_RE = /^<!--copilot-meta\s+([\s\S]*?)\s*-->\s*/;

type UnifiedSource = "boss" | "inbox";
interface UnifiedJob extends BossJob {
  source: UnifiedSource;
  path?: string;
  score?: number;
  reason?: string;
  jd?: string;
}

function packPath(job: string): string {
  const safe = (job || "JD").replace(/[\\/:*?"<>|]/g, "").slice(0, 40) || "JD";
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `preps/${safe}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.md`;
}

function parseInbox(path: string, raw: string): UnifiedJob | null {
  const m = raw.match(META_RE);
  if (!m) return null;
  let meta: Record<string, unknown> = {};
  try {
    meta = JSON.parse(m[1]);
  } catch {
    return null;
  }
  let body = raw.slice(m[0].length);
  body = body.replace(/^#[^\n]*\n/, "").replace(/^(>[^\n]*\n)+/, "").trim();
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);
  const href = str(meta.href);
  return {
    source: "inbox",
    path,
    id: path,
    href,
    title: str(meta.title) || "(无标题)",
    company: str(meta.company),
    salary: str(meta.salary),
    tags: "扩展推送",
    score: num(meta.score),
    reason: str(meta.reason),
    jd: body,
  };
}

export function BossPanel(props: {
  gateway: GatewayConfig;
  workflowStep: WorkflowStep;
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
  inboxRefreshKey: number;
  contentTier: Tier;
  onContentTierChange: (tier: Tier) => void;
  onPickJd: (jd: string) => void;
  onGenerated: (path: string) => void;
  onCandidateCount?: (count: number) => void;
  onContentStatus?: (status: ContentTaskStatus) => void;
  onApplyStatus?: (status: ApplyTaskStatus) => void;
  onApplied?: () => void;
}) {
  const [err, setErr] = useState("");
  const [opening, setOpening] = useState(false);
  const [searching, setSearching] = useState(false);
  const [fetching, setFetching] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [bossJobs, setBossJobs] = useState<UnifiedJob[]>([]);
  const [inboxJobs, setInboxJobs] = useState<UnifiedJob[]>([]);
  const [expanded, setExpanded] = useState("");
  const [generatingId, setGeneratingId] = useState("");
  const [applyJob, setApplyJob] = useState<BossJob | null>(null);
  const [showBatch, setShowBatch] = useState(false);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(() => loadApplied());
  const [replies, setReplies] = useState<BossReplies | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState("");
  const desktop = isDesktop();
  const safety = normalizeApplySafety(props);

  const allJobs = useMemo(() => [...bossJobs, ...inboxJobs], [bossJobs, inboxJobs]);

  useEffect(() => {
    props.onCandidateCount?.(allJobs.length);
  }, [allJobs.length, props]);

  useEffect(() => {
    refreshInbox();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.root, props.inboxRefreshKey]);

  async function refreshInbox() {
    if (!props.root) return;
    try {
      const files = (await fsList(props.root)).filter((x) => x.startsWith("jds/") && x.toLowerCase().endsWith(".md"));
      const out: UnifiedJob[] = [];
      for (const f of files) {
        try {
          const parsed = parseInbox(f, await fsRead(props.root, f));
          if (parsed) out.push(parsed);
        } catch {
          /* skip */
        }
      }
      out.sort((a, b) => (b.score || 0) - (a.score || 0));
      setInboxJobs(out);
    } catch (e) {
      setErr(String(e));
    }
  }

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

  function handleApplied(rec: ApplyRecord) {
    addRecord(rec);
    setAppliedIds((s) => new Set(s).add(rec.id));
    props.onApplied?.();
    props.onApplyStatus?.({ state: "done", done: 1, total: 1, message: "已投递" });
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
      const n = await feishuSync(props.feishuAppId, props.feishuAppSecret, props.feishuUserToken, props.feishuBaseToken, props.feishuTableId, buildFeishuRecords(recs));
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

  async function scoreJobs(list: UnifiedJob[]) {
    setAnalyzing(true);
    const next: UnifiedJob[] = [];
    for (const j of list.slice(0, 20)) {
      try {
        const out = await chat(props.gateway, {
          tier: "light",
          system: "你是求职岗位匹配助手。只返回一行：分数|理由。分数是0-100整数，理由不超过28个中文字符。",
          messages: [{ role: "user", content: `目标:${props.job}\n城市:${props.city}\n简历:${props.resume.slice(0, 1200)}\n岗位:${j.title}\n公司:${j.company}\n薪资:${j.salary}\n标签:${j.tags}` }],
          maxTokens: 120,
        });
        const [scoreRaw, reasonRaw] = out.split("|");
        next.push({ ...j, score: Math.max(0, Math.min(100, Number(scoreRaw) || 0)), reason: (reasonRaw || out).trim() });
      } catch {
        next.push({ ...j, score: 0, reason: "待人工判断" });
      }
    }
    setAnalyzing(false);
    return next;
  }

  async function search() {
    if (!props.job) {
      setErr("请先在「目标岗位」选/加一个岗位。");
      return;
    }
    setErr("");
    setSearching(true);
    setBossJobs([]);
    try {
      const raw = await bossSearch(props.job, cityCode(props.city));
      const list: UnifiedJob[] = raw.filter((j) => salaryMatches(j.salary, props.salary)).map((j) => ({ ...j, source: "boss" }));
      setBossJobs(await scoreJobs(list));
      if (!raw.length) setErr("没抓到岗位卡片(确认 BOSS 窗口已登录且停在搜索页)。");
      else if (!list.length) setErr(`抓到 ${raw.length} 条,但都不在「${props.salary}」区间。换个薪资档位或选「不限」。`);
      else if (list.length < raw.length) setErr(`已按薪资「${props.salary}」过滤:${raw.length} → ${list.length} 条。`);
    } catch (e) {
      setErr(String(e));
    } finally {
      setSearching(false);
    }
  }

  async function ensureJd(j: UnifiedJob): Promise<string> {
    if (j.jd) return j.jd;
    setFetching(j.id || j.href || j.path || j.title);
    props.onContentStatus?.({ state: "fetching", tier: props.contentTier, model: modelName(), message: "正在抓取 JD" });
    try {
      const detail = await bossFetchJd(j.href);
      const jd = detail.jd || "";
      if (!jd) throw new Error("详情页没抓到 JD 正文。");
      patchJob(j, { jd });
      props.onPickJd(jd);
      return jd;
    } finally {
      setFetching("");
    }
  }

  function patchJob(job: UnifiedJob, patch: Partial<UnifiedJob>) {
    const key = job.id || job.href || job.path;
    const map = (j: UnifiedJob) => ((j.id || j.href || j.path) === key ? { ...j, ...patch } : j);
    setBossJobs((xs) => xs.map(map));
    setInboxJobs((xs) => xs.map(map));
  }

  function modelName() {
    return props.contentTier === "deep" ? props.gateway.deep.model : props.gateway.light.model;
  }

  async function generatePack(j: UnifiedJob) {
    if (!props.root) {
      setErr("数据目录尚未就绪(桌面版才能生成到文件)。");
      return;
    }
    const id = j.id || j.href || j.path || j.title;
    setGeneratingId(id);
    setErr("");
    let content = "";
    try {
      const jd = await ensureJd(j);
      props.onContentStatus?.({ state: "thinking", tier: props.contentTier, model: modelName(), message: j.title });
      content = await chat(props.gateway, {
        tier: props.contentTier,
        system: contentPackSystem(props.instruction),
        messages: [{ role: "user", content: contentPackUser({ jd, job: j.title || props.job || "(未指定)", city: props.city, resume: props.resume }) }],
        maxTokens: 8000,
        onThinking: () => props.onContentStatus?.({ state: "thinking", tier: props.contentTier, model: modelName(), message: j.title }),
        onDelta: () => props.onContentStatus?.({ state: "generating", tier: props.contentTier, model: modelName(), message: j.title }),
      });
      if (!content.trim()) throw new Error("生成结果为空,请重试或换个档位。");
      const path = packPath(j.title || props.job);
      await fsWrite(props.root, path, content);
      props.onGenerated(path);
      props.onContentStatus?.({ state: "done", tier: props.contentTier, model: modelName(), path });
    } catch (e) {
      const message = e instanceof GatewayError ? e.message : String(e);
      setErr(message);
      props.onContentStatus?.({ state: "error", tier: props.contentTier, model: modelName(), message });
    } finally {
      setGeneratingId("");
    }
  }

  function toggleExpand(j: UnifiedJob) {
    const id = j.id || j.href || j.path || j.title;
    setExpanded((cur) => (cur === id ? "" : id));
    if (j.jd) props.onPickJd(j.jd);
  }

  if (!desktop) {
    return (
      <div className="card">
        <h3 className="flex items-center gap-2"><Bot size={18} strokeWidth={1.75} className="text-accent-strong" />BOSS 自动投递 · 桌面版</h3>
        <p className="hint" style={{ marginTop: 0 }}>此功能仅<strong>桌面版</strong>可用。当前是网页预览版,请用 <code>npx tauri dev</code> 启动桌面版体验。</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="mb-3 rounded border border-border bg-surface-3 p-3">
        <WorkflowRail current={props.workflowStep} />
        <div className="metrics">
          <div className={"metric" + (getDaily() >= safety.dailyCap ? " warn" : "")}>
            <span className="metric-num">{getDaily()}<span className="metric-cap">/{safety.dailyCap}</span></span>
            <span className="metric-label">今日已投{getDaily() >= safety.dailyCap ? " · 已达上限" : ""}</span>
          </div>
          <div className="metric"><span className="metric-num">{appliedIds.size}</span><span className="metric-label">累计已投</span></div>
          <div className="metric"><span className="metric-num">{allJobs.length}</span><span className="metric-label">候选岗位</span></div>
        </div>
      </div>

      <div className="row" style={{ alignItems: "flex-start", marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <h3 className="flex items-center gap-2" style={{ marginBottom: 4 }}><Bot size={18} strokeWidth={1.75} className="text-accent-strong" />BOSS 自动投递 · 岗位列表</h3>
          <p className="hint" style={{ marginTop: 0 }}>按当前目标岗位<strong>「{props.job || "（未选）"}」</strong> + 城市<strong>「{props.city}」</strong>抓取岗位；列表内完成评分、JD、内容包和投递。</p>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <span className="hint">档位</span>
          <select value={props.contentTier} style={{ width: 150 }} onChange={(e) => props.onContentTierChange(e.target.value as Tier)}>
            <option value="light">轻活 Flash</option>
            <option value="deep">深度 Pro</option>
          </select>
        </div>
      </div>

      <div className="row" style={{ flexWrap: "wrap" }}>
        <Button variant="ghost" loading={opening} onClick={open} icon={<KeyRound size={16} strokeWidth={1.75} />}>{opening ? "打开中..." : "打开 / 登录 BOSS"}</Button>
        <Button variant="primary" loading={searching || analyzing} onClick={search} icon={<Download size={16} strokeWidth={1.75} />}>{searching ? "抓取中..." : analyzing ? "评分中..." : "抓取岗位"}</Button>
        {allJobs.length > 0 && <Button onClick={() => setShowBatch(true)} icon={<Send size={16} strokeWidth={1.75} />}>批量投递({allJobs.length})</Button>}
        <Button variant="ghost" loading={refreshing} onClick={refreshReplies} icon={<RefreshCw size={16} strokeWidth={1.75} />}>{refreshing ? "刷新中..." : "刷新回复"}</Button>
        <Button variant="ghost" loading={syncing} onClick={syncFeishu} icon={<RefreshCw size={16} strokeWidth={1.75} />}>{syncing ? "同步中..." : "同步飞书"}</Button>
        <Button variant="ghost" size="sm" onClick={refreshInbox} icon={<RefreshCw size={14} strokeWidth={1.75} />}>刷新扩展岗位</Button>
        <span className="tier-pill inline-flex items-center gap-1"><ShieldCheck size={13} strokeWidth={1.75} />step 3b · 半自动投递</span>
      </div>
      {err && <div className="err">{err}</div>}
      {syncNote && <div className="hint" style={{ marginTop: 6 }}>{syncNote}</div>}

      {replies && (
        <div className="funnel">
          <div className="funnel-cell"><span className="funnel-num">{appliedIds.size}</span><span className="hint">累计已投</span></div>
          <div className="funnel-arrow"><ArrowRight size={18} strokeWidth={1.75} /></div>
          <div className="funnel-cell"><span className="funnel-num">{replies.total}</span><span className="hint">已沟通会话</span></div>
          <div className="funnel-arrow"><ArrowRight size={18} strokeWidth={1.75} /></div>
          <div className="funnel-cell"><span className="funnel-num" style={{ color: "var(--accent-strong)" }}>{replies.withReply}</span><span className="hint">有新回复</span></div>
        </div>
      )}

      <div className="mt-3 grid gap-2">
        {allJobs.length === 0 ? (
          <div className="rounded border border-dashed border-border bg-surface-3 p-4 text-aux text-text-2">暂无候选岗位。点击“抓取岗位”，或在 BOSS 扩展里推送收藏岗位后刷新。</div>
        ) : allJobs.map((j) => {
          const id = j.id || j.href || j.path || j.title;
          const openRow = expanded === id;
          return (
            <div key={id} className="rounded border border-border bg-surface-3 p-3">
              <div className="flex items-start gap-3">
                <button className="icon-btn ghost shrink-0" title={openRow ? "收起 JD" : "展开 JD"} onClick={() => toggleExpand(j)}>{openRow ? <ChevronDown size={16} strokeWidth={1.75} /> : <ChevronRight size={16} strokeWidth={1.75} />}</button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-text">{j.title || "(无标题)"}</span>
                    {j.salary && <span className="job-row-salary">{j.salary}</span>}
                    <span className="tier-pill">{j.source === "inbox" ? "扩展" : "抓取"}</span>
                    {typeof j.score === "number" && <span className="rounded-full bg-ai-soft px-2 py-0.5 text-[12px] font-semibold text-ai">AI {j.score}</span>}
                  </div>
                  <div className="hint mt-1">{[j.company, j.tags].filter(Boolean).join(" · ")}</div>
                  {j.reason && <div className="hint mt-1 inline-flex max-w-full items-center gap-1"><Lightbulb size={13} strokeWidth={1.75} className="shrink-0" /><span className="truncate">{j.reason}</span></div>}
                </div>
                {j.href && <a className="inline-flex items-center justify-center rounded border border-border bg-surface px-2 py-1.5 text-text-2 no-underline hover:border-accent hover:text-accent-strong" href={j.href} target="_blank" rel="noreferrer" title="打开原岗位"><ExternalLink size={14} strokeWidth={1.75} /></a>}
                <Button variant="ghost" size="sm" disabled={!!fetching} onClick={() => ensureJd(j).then((jd) => props.onPickJd(jd)).catch((e) => setErr(String(e)))} icon={<FileText size={14} strokeWidth={1.75} />}>{fetching === id ? "抓取中..." : "JD"}</Button>
                <Button size="sm" loading={generatingId === id} onClick={() => generatePack(j)} icon={<Sparkles size={14} strokeWidth={1.75} />}>内容包</Button>
                <Button size="sm" onClick={() => setApplyJob(j)} icon={<Send size={14} strokeWidth={1.75} />}>{appliedIds.has(j.id || j.href) ? "再投" : "投递"}</Button>
              </div>
              {openRow && (
                <div className="mt-3 rounded border border-border bg-surface p-3">
                  <div className="mb-2 text-[12px] font-semibold text-text-2">岗位 JD</div>
                  <textarea rows={5} value={j.jd || ""} placeholder="点击 JD 按钮抓取，或由扩展推送自动带入。" onChange={(e) => { patchJob(j, { jd: e.target.value }); props.onPickJd(e.target.value); }} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {applyJob && <ApplyModal gateway={props.gateway} jobLabel={props.job} city={props.city} bossJob={applyJob} resume={props.resume} instruction={props.instruction} root={props.root} dailyCap={safety.dailyCap} onClose={() => setApplyJob(null)} onApplied={handleApplied} />}
      {showBatch && <BatchApplyModal gateway={props.gateway} jobs={allJobs} jobLabel={props.job} city={props.city} resume={props.resume} instruction={props.instruction} dailyCap={safety.dailyCap} delayMin={safety.delayMin} delayMax={safety.delayMax} onClose={() => setShowBatch(false)} onApplied={handleApplied} />}
    </div>
  );
}
