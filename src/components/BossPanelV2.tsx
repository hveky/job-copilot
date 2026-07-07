import { Fragment, useEffect, useMemo, useState } from "react";
import {
  Bot,
  KeyRound,
  Download,
  Send,
  RefreshCw,
  FileText,
  Sparkles,
  ChevronDown,
  Search,
  TriangleAlert,
  BrainCircuit,
} from "lucide-react";
import { Button, StatusPill } from "../ui";
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
import { getAppliedKeys, markSynced, recordApply, unsyncedRecords, type ApplyRecord } from "../lib/ledger";
import { buildFeishuRecords } from "../lib/feishu";
import type { GatewayConfig, Tier } from "../gateway/types";
import { chat, GatewayError } from "../gateway/client";
import { contentPackSystem, contentPackUser } from "../prompts/templates";
import { normalizeApplySafety } from "../lib/applySafety";
import type { ApplyTaskStatus, ContentTaskStatus } from "./TaskStatusBar";
import {
  listCandidateJobs,
  normalizeCandidateJob,
  updateCandidateJd,
  updateCandidateScore,
  upsertCandidateJobs,
  type CandidateJob,
} from "../lib/jobStore";
import {
  buildScorePrompt,
  inferDirection,
  parseScoreResponse,
  ruleFallbackScore,
  runLimitedQueue,
  type ParsedScore,
} from "../lib/jobScoring";
import {
  candidateMatchesScope,
  scoreProgress,
  shouldAutoScore,
  type ScoreProgress,
} from "../lib/jobWorkflow";

const META_RE = /^<!--copilot-meta\s+([\s\S]*?)\s*-->\s*/;
const SCORE_CONCURRENCY = 3;
const AVATAR_STYLES = ["bg-[#1D6FEA]", "bg-[#0891B2]", "bg-[#16A34A]", "bg-[#7C3AED]", "bg-[#F97316]", "bg-[#0284C7]"];
const AVATAR_LETTERS = ["M", "S", "G", "B", "A", "C"];

type MatchFilter = "all" | "high" | "medium" | "low";

function packPath(job: string): string {
  const safe = (job || "JD").replace(/[\\/:*?"<>|]/g, "").slice(0, 40) || "JD";
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `preps/${safe}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.md`;
}

function parseInbox(path: string, raw: string, city: string, track: string): CandidateJob | null {
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
  const num = (v: unknown) => (typeof v === "number" ? v : Number(v));
  const score = Number.isFinite(num(meta.score)) ? Math.max(0, Math.min(100, Math.round(num(meta.score)))) : undefined;
  return normalizeCandidateJob(
    {
      id: path,
      href: str(meta.href),
      title: str(meta.title) || "(无标题)",
      company: str(meta.company),
      salary: str(meta.salary),
      tags: "扩展推送",
      score,
      reason: str(meta.reason),
      jd: body,
      scoreStatus: typeof score === "number" ? "scored" : "pending",
    },
    { source: "inbox", path, city, track, jd: body, score, reason: str(meta.reason) },
  );
}

function scoreOf(job: CandidateJob): number {
  return typeof job.score === "number" ? Math.max(0, Math.min(100, job.score)) : 0;
}

function matchLevel(job: CandidateJob): Exclude<MatchFilter, "all"> {
  const score = scoreOf(job);
  if (score >= 80) return "high";
  if (score >= 70) return "medium";
  return "low";
}

function matchLabel(level: Exclude<MatchFilter, "all">) {
  if (level === "high") return "高匹配";
  if (level === "medium") return "中匹配";
  return "低匹配";
}

function splitTags(tags: string) {
  const parts = (tags || "").split(/[·|｜,，/\s]+/).map((x) => x.trim()).filter(Boolean);
  return {
    companySize: parts.find((x) => /人|规模/.test(x)) || "200-500人",
    experience: parts.find((x) => /年|经验|应届/.test(x)) || "经验不限",
    education: parts.find((x) => /本科|硕士|大专|学历/.test(x)) || "学历不限",
    extra: parts.filter((x) => !/人|规模|年|经验|应届|本科|硕士|大专|学历/.test(x)).slice(0, 2).join(" · "),
  };
}

function salaryParts(salary: string) {
  const parts = (salary || "").split(/[·,，\s]+/).filter(Boolean);
  return { main: parts[0] || "面议", months: parts.find((x) => /薪/.test(x)) || "" };
}

function listFromJson(raw: string): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.map((x) => String(x)).filter(Boolean) : [];
  } catch {
    return raw.split(/[；;，,\n]/).map((x) => x.trim()).filter(Boolean);
  }
}

function scopeMatches(job: CandidateJob, target: string, city: string, salary: string) {
  return candidateMatchesScope(job, { target, city, salary });
}

export function BossPanelV2(props: {
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
  inboxRefreshKey: number;
  contentTier: Tier;
  onContentTierChange: (tier: Tier) => void;
  onPickJd: (jd: string) => void;
  onGenerated: (path: string) => void;
  onCandidateCount?: (count: number) => void;
  onContentStatus?: (status: ContentTaskStatus) => void;
  onApplyStatus?: (status: ApplyTaskStatus) => void;
  onScoreStatus?: (status: ScoreProgress) => void;
  onApplied?: () => void;
}) {
  const [err, setErr] = useState("");
  const [opening, setOpening] = useState(false);
  const [searching, setSearching] = useState(false);
  const [fetching, setFetching] = useState("");
  const [jobs, setJobs] = useState<CandidateJob[]>([]);
  const [scoringIds, setScoringIds] = useState<Set<string>>(() => new Set());
  const [expanded, setExpanded] = useState("");
  const [generatingId, setGeneratingId] = useState("");
  const [applyJob, setApplyJob] = useState<BossJob | null>(null);
  const [showBatch, setShowBatch] = useState(false);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(() => new Set());
  const [replies, setReplies] = useState<BossReplies | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState("");
  const [filter, setFilter] = useState<MatchFilter>("all");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const desktop = isDesktop();
  const safety = normalizeApplySafety(props);

  const scopedJobs = useMemo(() => jobs.filter((j) => scopeMatches(j, props.job, props.city, props.salary)), [jobs, props.job, props.city, props.salary]);
  const allJobs = useMemo(() => [...scopedJobs].sort((a, b) => scoreOf(b) - scoreOf(a) || b.updatedAt - a.updatedAt), [scopedJobs]);
  const counts = useMemo(() => {
    const scorable = allJobs.filter((j) => j.scoreStatus !== "pending" && j.scoreStatus !== "scoring");
    return {
      all: allJobs.length,
      high: scorable.filter((j) => matchLevel(j) === "high").length,
      medium: scorable.filter((j) => matchLevel(j) === "medium").length,
      low: scorable.filter((j) => matchLevel(j) === "low").length,
    };
  }, [allJobs]);
  const visibleJobs = useMemo(() => {
    if (filter === "all") return allJobs;
    return allJobs.filter((j) => j.scoreStatus !== "pending" && j.scoreStatus !== "scoring" && matchLevel(j) === filter);
  }, [allJobs, filter]);
  const scoringCount = scoringIds.size;

  useEffect(() => {
    props.onCandidateCount?.(allJobs.length);
  }, [allJobs.length, props.onCandidateCount]);

  useEffect(() => {
    props.onScoreStatus?.(scoreProgress(allJobs));
  }, [allJobs, props.onScoreStatus]);

  useEffect(() => {
    listCandidateJobs().then((rows) => setJobs(rows)).catch((e) => setErr(String(e)));
    getAppliedKeys().then(setAppliedIds).catch(() => {});
  }, []);

  useEffect(() => {
    refreshInbox();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.root, props.inboxRefreshKey]);

  function mergeJobs(nextJobs: CandidateJob[]) {
    setJobs((current) => {
      const map = new Map(current.map((j) => [j.id, j]));
      nextJobs.forEach((j) => map.set(j.id, { ...map.get(j.id), ...j }));
      return [...map.values()];
    });
  }

  function patchJob(id: string, patch: Partial<CandidateJob>) {
    setJobs((xs) => xs.map((j) => (j.id === id ? { ...j, ...patch, updatedAt: Date.now() } : j)));
  }

  async function refreshInbox() {
    if (!props.root) return;
    try {
      const files = (await fsList(props.root)).filter((x) => x.startsWith("jds/") && x.toLowerCase().endsWith(".md"));
      const out: CandidateJob[] = [];
      for (const f of files) {
        try {
          const parsed = parseInbox(f, await fsRead(props.root, f), props.city, props.job);
          if (parsed) out.push(parsed);
        } catch {
          /* skip */
        }
      }
      if (out.length > 0) {
        const saved = await upsertCandidateJobs(out);
        mergeJobs(saved);
        void scoreJobs(saved.filter(shouldAutoScore));
      }
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
    const matched = jobs.find((j) => j.id === rec.id || j.href === rec.href);
    const rich: ApplyRecord = {
      ...rec,
      salary: rec.salary || matched?.salary || "",
      region: rec.region || matched?.region || matched?.area || "",
      direction: rec.direction || matched?.direction || inferDirection(rec.title, rec.track),
    };
    setAppliedIds((s) => {
      const next = new Set(s).add(rich.id);
      if (rich.href) next.add(rich.href);
      return next;
    });
    void recordApply(rich)
      .catch((e) => setErr(`投递记录保存失败:${String(e)}`))
      .finally(() => props.onApplied?.());
    props.onApplyStatus?.({ state: "done", done: 1, total: 1, message: "已投递" });
  }

  async function syncFeishu() {
    setSyncNote("");
    if (!props.feishuUserToken && (!props.feishuAppId || !props.feishuAppSecret)) {
      setSyncNote("请先在设置中完成飞书授权，或填写 app_id / app_secret。");
      return;
    }
    setSyncing(true);
    try {
      const recs = await unsyncedRecords();
      if (recs.length === 0) {
        setSyncNote("没有待同步的投递记录。");
        return;
      }
      const n = await feishuSync(props.feishuAppId, props.feishuAppSecret, props.feishuUserToken, props.feishuBaseToken, props.feishuTableId, buildFeishuRecords(recs));
      await markSynced(recs.map((r) => r.id));
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

  function scoreInput(job: CandidateJob) {
    return {
      target: props.job,
      city: props.city,
      salary: props.salary,
      resume: props.resume,
      title: job.title,
      company: job.company,
      jobCity: job.city,
      salaryText: job.salary,
      tags: job.tags,
      jd: job.jd,
    };
  }

  async function requestAiScore(job: CandidateJob): Promise<ParsedScore> {
    const out = await chat(props.gateway, {
      tier: "light",
      system: "你是求职岗位匹配评分器。必须只返回符合要求的 JSON，不要 Markdown。",
      messages: [{ role: "user", content: buildScorePrompt(scoreInput(job)) }],
      maxTokens: 900,
    });
    return parseScoreResponse(out);
  }

  async function scoreOne(job: CandidateJob, force = false): Promise<CandidateJob> {
    if (!force && job.scoreStatus === "scored" && typeof job.score === "number") return job;
    setScoringIds((cur) => new Set(cur).add(job.id));
    patchJob(job.id, { scoreStatus: "scoring" });

    let parsed: ParsedScore | null = null;
    let aiFailed = false;
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          parsed = await requestAiScore(job);
          aiFailed = false;
          break;
        } catch {
          aiFailed = true;
        }
      }
      if (!parsed) parsed = ruleFallbackScore(scoreInput(job));
      const saved = await updateCandidateScore(job.id, {
        score: parsed.score,
        level: parsed.level,
        reason: parsed.reason,
        highlights: JSON.stringify(parsed.highlights),
        risks: JSON.stringify(parsed.risks),
        scoreStatus: aiFailed ? "failed" : "scored",
      });
      patchJob(job.id, saved);
      return saved;
    } catch (e) {
      const fallback = parsed ?? ruleFallbackScore(scoreInput(job));
      const failedPatch = {
        score: fallback.score,
        level: fallback.level,
        reason: fallback.reason,
        highlights: JSON.stringify(fallback.highlights),
        risks: JSON.stringify(fallback.risks),
        scoreStatus: "failed" as const,
      };
      patchJob(job.id, failedPatch);
      setErr(`评分状态保存失败:${String(e)}`);
      return { ...job, ...failedPatch };
    } finally {
      setScoringIds((cur) => {
        const next = new Set(cur);
        next.delete(job.id);
        return next;
      });
    }
  }
  async function scoreJobs(list: CandidateJob[]) {
    const pending = list.filter(shouldAutoScore);
    if (pending.length === 0) return;
    await runLimitedQueue(pending, SCORE_CONCURRENCY, async (job) => scoreOne(job));
  }

  async function search() {
    if (!props.job) {
      setErr("请先在投递设置中选择目标岗位。");
      return;
    }
    setErr("");
    setSearching(true);
    props.onApplyStatus?.({ state: "idle", done: 0, total: 0 });
    try {
      const raw = await bossSearch(props.job, cityCode(props.city));
      const list = raw
        .filter((j) => salaryMatches(j.salary, props.salary))
        .map((j) => normalizeCandidateJob(j, { source: "boss", city: props.city, track: props.job }));
      const saved = await upsertCandidateJobs(list.map((j) => ({ ...j, scoreStatus: "pending", score: undefined, reason: "", highlights: "", risks: "" })));
      setJobs((current) => {
        const outsideScope = current.filter((j) => !scopeMatches(j, props.job, props.city, props.salary));
        return [...outsideScope, ...saved];
      });
      void scoreJobs(saved);
      if (!raw.length) setErr("没抓到岗位卡片，请确认 BOSS 窗口已登录且停在搜索页。");
      else if (!list.length) setErr(`抓到 ${raw.length} 条，但都不在「${props.salary}」区间。可换薪资档位或选「不限」。`);
      else if (list.length < raw.length) setErr(`已按薪资「${props.salary}」过滤：${raw.length} → ${list.length} 条。`);
    } catch (e) {
      setErr(String(e));
    } finally {
      setSearching(false);
    }
  }

  async function ensureJd(j: CandidateJob): Promise<string> {
    if (j.jd) return j.jd;
    setFetching(j.id);
    props.onContentStatus?.({ state: "fetching", tier: props.contentTier, model: modelName(), message: "正在抓取 JD" });
    try {
      const detail = await bossFetchJd(j.href);
      const jd = detail.jd || "";
      if (!jd) throw new Error("详情页没抓到 JD 正文。");
      const saved = await updateCandidateJd(j.id, jd);
      patchJob(j.id, saved);
      props.onPickJd(jd);
      return jd;
    } finally {
      setFetching("");
    }
  }

  function modelName() {
    return props.contentTier === "deep" ? props.gateway.deep.model : props.gateway.light.model;
  }

  async function generatePack(j: CandidateJob) {
    if (!props.root) {
      setErr("数据目录尚未就绪，桌面版才能生成到文件。");
      return;
    }
    setGeneratingId(j.id);
    setErr("");
    try {
      const jd = await ensureJd(j);
      props.onContentStatus?.({ state: "thinking", tier: props.contentTier, model: modelName(), message: j.title });
      const content = await chat(props.gateway, {
        tier: props.contentTier,
        system: contentPackSystem(props.instruction),
        messages: [{ role: "user", content: contentPackUser({ jd, job: j.title || props.job || "(未指定)", city: props.city, resume: props.resume }) }],
        maxTokens: 8000,
        onThinking: () => props.onContentStatus?.({ state: "thinking", tier: props.contentTier, model: modelName(), message: j.title }),
        onDelta: () => props.onContentStatus?.({ state: "generating", tier: props.contentTier, model: modelName(), message: j.title }),
      });
      if (!content.trim()) throw new Error("生成结果为空，请重试或换个档位。");
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

  function toggleExpand(j: CandidateJob) {
    setExpanded((cur) => (cur === j.id ? "" : j.id));
    if (j.jd) props.onPickJd(j.jd);
  }

  function toggleSelected(id: string) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((cur) => {
      const next = new Set(cur);
      const ids = visibleJobs.map((j) => j.id);
      const allSelected = ids.length > 0 && ids.every((id) => next.has(id));
      ids.forEach((id) => (allSelected ? next.delete(id) : next.add(id)));
      return next;
    });
  }

  const filterTabs: Array<{ key: MatchFilter; label: string; count: number }> = [
    { key: "all", label: "全部", count: counts.all },
    { key: "high", label: "高匹配", count: counts.high },
    { key: "medium", label: "中匹配", count: counts.medium },
    { key: "low", label: "低匹配", count: counts.low },
  ];

  if (!desktop) {
    return (
      <section className="rounded border border-border bg-surface p-[18px] shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <h3 className="m-0 flex items-center gap-2 text-[14px] font-bold leading-5">
          <Bot size={18} strokeWidth={1.75} className="text-accent-strong" />
          候选岗位
        </h3>
        <p className="hint mt-2">此功能仅桌面版可用。当前是网页预览版，请用桌面壳启动体验。</p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded border border-border bg-surface shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <header className="flex flex-wrap items-start gap-3 border-b border-border px-[18px] py-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="m-0 text-[15px] font-bold leading-[22px] text-text">候选岗位</h3>
            <span className="text-[12px] leading-4 text-text-2">共 {allJobs.length} 个岗位（匹配评分由高到低）</span>
            {scoringCount > 0 && <StatusPill tone="ai">评分中 {scoringCount}</StatusPill>}
          </div>
          <p className="mt-1 mb-0 text-[12px] leading-4 text-text-2">
            当前目标：<strong className="text-text">{props.job || "未设置"}</strong> · 城市：<strong className="text-text">{props.city || "不限"}</strong> · 薪资：<strong className="text-text">{props.salary || "不限"}</strong>
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="secondary" size="sm" loading={searching || scoringCount > 0} onClick={search} icon={<RefreshCw size={14} strokeWidth={1.75} />}>
            刷新岗位
          </Button>
        </div>
      </header>

      <div className="px-[18px] py-3">
        <div className="flex flex-wrap items-center gap-2">
          {filterTabs.map((tab) => (
            <button key={tab.key} type="button" onClick={() => setFilter(tab.key)} className={"h-[34px] rounded border px-3 text-[13px] font-medium " + (filter === tab.key ? "border-[#6EE7C8] bg-accent-soft text-accent-strong" : "border-border bg-surface text-text-2 hover:border-accent hover:text-accent-strong")}>
              {tab.label} <strong>{tab.count}</strong>
            </button>
          ))}
          <span className="flex-1" />
          <span className="text-[12px] text-text-2">内容模型</span>
          <select value={props.contentTier} className="h-[34px] w-[132px] py-1 text-[13px]" onChange={(e) => props.onContentTierChange(e.target.value as Tier)}>
            <option value="light">轻活 Flash</option>
            <option value="deep">深度 Pro</option>
          </select>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" loading={opening} onClick={open} icon={<KeyRound size={15} strokeWidth={1.75} />}>{opening ? "打开中..." : "打开 / 登录 BOSS"}</Button>
          <Button variant="primary" size="sm" loading={searching} onClick={search} icon={<Download size={15} strokeWidth={1.75} />}>{searching ? "抓取中..." : "抓取岗位"}</Button>
          {allJobs.length > 0 && <Button size="sm" onClick={() => setShowBatch(true)} icon={<Send size={15} strokeWidth={1.75} />}>批量投递({allJobs.length})</Button>}
          <Button variant="secondary" size="sm" loading={refreshing} onClick={refreshReplies} icon={<RefreshCw size={15} strokeWidth={1.75} />}>{refreshing ? "刷新中..." : "刷新回复"}</Button>
          <Button variant="secondary" size="sm" loading={syncing} onClick={syncFeishu} icon={<RefreshCw size={15} strokeWidth={1.75} />}>{syncing ? "同步中..." : "同步飞书"}</Button>
          <StatusPill tone="ai" className="ml-auto hidden xl:inline-flex">step 3b · 半自动投递</StatusPill>
        </div>

        {err && (
          <div className="mt-3 flex items-start gap-2 rounded border border-[color-mix(in_srgb,var(--danger)_25%,transparent)] bg-danger-soft px-3 py-2 text-[13px] text-danger">
            <TriangleAlert size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />
            <span>{err}</span>
          </div>
        )}
        {syncNote && <div className="mt-2 text-[12px] leading-4 text-text-2">{syncNote}</div>}
        {replies && <div className="mt-2 text-[12px] leading-4 text-text-2">回复漏斗：累计已投 {appliedIds.size} · 已沟通会话 {replies.total} · 有新回复 {replies.withReply}</div>}
      </div>

      <div className="overflow-x-auto px-[18px] pb-2">
        <table className="w-full min-w-[820px] border-separate border-spacing-0 overflow-hidden rounded border border-border text-left">
          <thead>
            <tr className="h-10 bg-[#F8FAFC] text-[12px] font-semibold leading-4 text-[#475569]">
              <th className="w-11 border-b border-border px-3"><input type="checkbox" checked={visibleJobs.length > 0 && visibleJobs.every((j) => selected.has(j.id))} onChange={toggleAllVisible} /></th>
              <th className="border-b border-border px-3">岗位信息</th>
              <th className="w-[150px] border-b border-border px-3">匹配评分</th>
              <th className="w-[110px] border-b border-border px-3">薪资</th>
              <th className="w-20 border-b border-border px-3">城市</th>
              <th className="w-24 border-b border-border px-3">状态</th>
              <th className="w-[128px] border-b border-border px-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {visibleJobs.length === 0 ? (
              <tr>
                <td colSpan={7} className="h-[220px] border-b border-border px-4 text-center">
                  <div className="mx-auto flex max-w-[360px] flex-col items-center justify-center gap-2 text-text-2">
                    <Search size={28} strokeWidth={1.75} className="text-muted" />
                    <div className="text-[14px] font-bold text-text">暂无候选岗位</div>
                    <div className="text-[12px] leading-5">完成目标设置后，可从 BOSS 抓取岗位并进行全量匹配评分。</div>
                    <Button size="sm" variant="primary" onClick={search} icon={<Download size={14} strokeWidth={1.75} />}>抓取岗位</Button>
                  </div>
                </td>
              </tr>
            ) : visibleJobs.map((j, index) => {
              const openRow = expanded === j.id;
              const level = matchLevel(j);
              const score = scoreOf(j);
              const tags = splitTags(j.tags);
              const salary = salaryParts(j.salary);
              const applied = appliedIds.has(j.id || j.href);
              const low = j.scoreStatus !== "pending" && j.scoreStatus !== "scoring" && level === "low";
              const statusLabel = applied ? "已投递" : low ? "低于阈值" : "待投递";
              const scoreLabel = j.scoreStatus === "pending" ? "待评分" : j.scoreStatus === "scoring" || scoringIds.has(j.id) ? "评分中" : j.scoreStatus === "failed" ? "失败可重试" : matchLabel(level);
              const highlights = listFromJson(j.highlights);
              const risks = listFromJson(j.risks);
              return (
                <Fragment key={j.id}>
                  <tr className="h-[78px] bg-surface text-[13px] leading-[18px] text-text hover:bg-[#FBFCFE]">
                    <td className="border-b border-border px-3"><input type="checkbox" checked={selected.has(j.id)} onChange={() => toggleSelected(j.id)} /></td>
                    <td className="border-b border-border px-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className={"flex h-10 w-10 shrink-0 items-center justify-center rounded text-[20px] font-bold text-white " + AVATAR_STYLES[index % AVATAR_STYLES.length]}>{AVATAR_LETTERS[index % AVATAR_LETTERS.length]}</span>
                        <div className="min-w-0">
                          <div className="truncate font-bold text-text">{j.title || "(无标题)"}</div>
                          <div className="truncate text-[12px] text-text-2">{j.company || "未知公司"} · {tags.companySize}</div>
                          <div className="truncate text-[12px] text-text-2">{tags.experience} · {tags.education}{tags.extra ? ` · ${tags.extra}` : ""}</div>
                        </div>
                      </div>
                    </td>
                    <td className="border-b border-border px-3">
                      <div className="flex items-center gap-2">
                        <strong className="w-8 text-[14px] text-text">{typeof j.score === "number" ? score : "待"}</strong>
                        <span className="h-1 w-24 overflow-hidden rounded-full bg-[#E5E7EB]"><i className="block h-full rounded-full bg-[#1D6FEA]" style={{ width: `${score}%` }} /></span>
                      </div>
                      <div className={"mt-1 text-[12px] font-medium " + (j.scoreStatus === "failed" ? "text-warn" : level === "high" ? "text-accent-strong" : level === "medium" ? "text-[#1D6FEA]" : "text-text-2")}>{scoreLabel}</div>
                    </td>
                    <td className="border-b border-border px-3"><div className="font-medium text-text">{salary.main}</div><div className="text-[12px] text-text-2">{salary.months || ""}</div></td>
                    <td className="border-b border-border px-3">{j.city || props.city || "不限"}</td>
                    <td className="border-b border-border px-3">
                      <span className={"inline-flex rounded-full px-2 py-1 text-[12px] font-medium " + (applied ? "bg-surface-2 text-text-2" : low ? "bg-ai-soft text-text-2" : "bg-[#FFF7ED] text-warn")}>{statusLabel}</span>
                      {low && <div className="mt-1 text-[12px] text-text-2">&lt; 70 分</div>}
                    </td>
                    <td className="border-b border-border px-3">
                      <div className="flex items-center gap-2">
                        {low || applied ? <Button size="sm" variant="secondary" className="min-w-[64px]" onClick={() => toggleExpand(j)}>详情</Button> : <Button size="sm" variant="primary" className="min-w-[72px] px-3" onClick={() => setApplyJob(j)} icon={<Send size={14} strokeWidth={1.75} />}>投递</Button>}
                        <button type="button" className="icon-btn ghost h-8 w-8" title="展开 JD 与 AI 分析" onClick={() => toggleExpand(j)}><ChevronDown size={15} strokeWidth={1.75} /></button>
                      </div>
                    </td>
                  </tr>
                  {openRow && (
                    <tr className="bg-[#FBFCFE]">
                      <td className="border-b border-border" />
                      <td colSpan={6} className="border-b border-border px-3 py-3">
                        <div className="grid gap-3 lg:grid-cols-[1fr_156px]">
                          <div>
                            <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold text-text-2"><FileText size={14} strokeWidth={1.75} /> 岗位 JD / AI 分析</div>
                            <div className="mb-2 rounded border border-border bg-surface px-3 py-2 text-[12px] leading-5 text-text-2">
                              <div><strong className="text-text">AI 理由：</strong>{j.reason || "点击 AI分析 后生成匹配理由。"}</div>
                              {highlights.length > 0 && <div className="mt-1"><strong className="text-accent-strong">亮点：</strong>{highlights.join("；")}</div>}
                              {risks.length > 0 && <div className="mt-1"><strong className="text-warn">风险：</strong>{risks.join("；")}</div>}
                            </div>
                            <textarea rows={4} value={j.jd || ""} placeholder="点击抓取 JD，或由扩展推送自动带入。" onChange={(e) => { patchJob(j.id, { jd: e.target.value }); props.onPickJd(e.target.value); }} onBlur={(e) => { void updateCandidateJd(j.id, e.currentTarget.value).catch((ex) => setErr(String(ex))); }} />
                          </div>
                          <div className="flex min-w-[150px] flex-col gap-2">
                            <Button variant="secondary" size="sm" disabled={!!fetching} onClick={() => ensureJd(j).then((jd) => props.onPickJd(jd)).catch((e) => setErr(String(e)))} icon={<FileText size={14} strokeWidth={1.75} />}>{fetching === j.id ? "抓取中..." : "抓取 JD"}</Button>
                            <Button variant="secondary" size="sm" loading={scoringIds.has(j.id)} onClick={() => scoreOne(j, true).catch((e) => setErr(String(e)))} icon={<BrainCircuit size={14} strokeWidth={1.75} />}>AI分析</Button>
                            <Button size="sm" loading={generatingId === j.id} onClick={() => generatePack(j)} icon={<Sparkles size={14} strokeWidth={1.75} />}>生成内容包</Button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <footer className="flex flex-wrap items-center gap-3 px-[18px] py-3 text-[12px] text-text-2">
        <label className="inline-flex items-center gap-2"><input type="checkbox" checked={visibleJobs.length > 0 && visibleJobs.every((j) => selected.has(j.id))} onChange={toggleAllVisible} /> 已选择 {selected.size} 个岗位</label>
        <span className="flex-1" />
        <span>评分队列：{scoringCount > 0 ? `进行中 ${scoringCount}` : "空闲"}</span>
      </footer>

      {applyJob && <ApplyModal gateway={props.gateway} jobLabel={props.job} city={props.city} bossJob={applyJob} resume={props.resume} instruction={props.instruction} root={props.root} dailyCap={safety.dailyCap} onClose={() => setApplyJob(null)} onApplied={handleApplied} />}
      {showBatch && <BatchApplyModal gateway={props.gateway} jobs={allJobs} jobLabel={props.job} city={props.city} resume={props.resume} instruction={props.instruction} dailyCap={safety.dailyCap} delayMin={safety.delayMin} delayMax={safety.delayMax} onClose={() => setShowBatch(false)} onApplied={handleApplied} />}
    </section>
  );
}
