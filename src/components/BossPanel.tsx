import { Fragment, useEffect, useMemo, useState } from "react";
import {
  Bot,
  KeyRound,
  Download,
  Send,
  RefreshCw,
  ExternalLink,
  FileText,
  Sparkles,
  ChevronDown,
  MoreHorizontal,
  SlidersHorizontal,
  Search,
  TriangleAlert,
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
import { addRecord, loadApplied, markSynced, unsyncedRecords, type ApplyRecord } from "../lib/ledger";
import { buildFeishuRecords } from "../lib/feishu";
import type { GatewayConfig, Tier } from "../gateway/types";
import { chat, GatewayError } from "../gateway/client";
import { contentPackSystem, contentPackUser } from "../prompts/templates";
import { normalizeApplySafety } from "../lib/applySafety";
import type { ApplyTaskStatus, ContentTaskStatus } from "./TaskStatusBar";

const META_RE = /^<!--copilot-meta\s+([\s\S]*?)\s*-->\s*/;
const AVATAR_STYLES = [
  "bg-[#1D6FEA]",
  "bg-[#0891B2]",
  "bg-[#16A34A]",
  "bg-[#7C3AED]",
  "bg-[#F97316]",
  "bg-[#0284C7]",
];
const AVATAR_LETTERS = ["M", "S", "G", "B", "A", "C"];

type UnifiedSource = "boss" | "inbox";
type MatchFilter = "all" | "high" | "medium" | "low";

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

function jobKey(job: UnifiedJob): string {
  return job.id || job.href || job.path || job.title;
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

function scoreOf(job: UnifiedJob): number {
  return typeof job.score === "number" ? Math.max(0, Math.min(100, job.score)) : 0;
}

function matchLevel(job: UnifiedJob): Exclude<MatchFilter, "all"> {
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
  const parts = (tags || "")
    .split(/[·|｜,，/\s]+/)
    .map((x) => x.trim())
    .filter(Boolean);
  return {
    companySize: parts.find((x) => /人|规模/.test(x)) || "200-500人",
    experience: parts.find((x) => /年|经验|应届/.test(x)) || "3-5年",
    education: parts.find((x) => /本科|硕士|大专|学历/.test(x)) || "本科",
    extra: parts.filter((x) => !/人|规模|年|经验|应届|本科|硕士|大专|学历/.test(x)).slice(0, 2).join(" · "),
  };
}

function salaryParts(salary: string) {
  const parts = (salary || "").split(/[·,，\s]+/).filter(Boolean);
  return {
    main: parts[0] || "面议",
    months: parts.find((x) => /薪/.test(x)) || "",
  };
}

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
  const [filter, setFilter] = useState<MatchFilter>("all");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const desktop = isDesktop();
  const safety = normalizeApplySafety(props);

  const allJobs = useMemo(() => {
    return [...bossJobs, ...inboxJobs].sort((a, b) => scoreOf(b) - scoreOf(a));
  }, [bossJobs, inboxJobs]);

  const counts = useMemo(() => {
    const high = allJobs.filter((j) => matchLevel(j) === "high").length;
    const medium = allJobs.filter((j) => matchLevel(j) === "medium").length;
    const low = allJobs.filter((j) => matchLevel(j) === "low").length;
    return { all: allJobs.length, high, medium, low };
  }, [allJobs]);

  const visibleJobs = useMemo(() => {
    if (filter === "all") return allJobs;
    return allJobs.filter((j) => matchLevel(j) === filter);
  }, [allJobs, filter]);

  useEffect(() => {
    props.onCandidateCount?.(allJobs.length);
  }, [allJobs.length, props.onCandidateCount]);

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
      out.sort((a, b) => scoreOf(b) - scoreOf(a));
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
      setSyncNote("请先在设置中完成飞书授权，或填写 app_id / app_secret。");
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
    if (list.length > 20) next.push(...list.slice(20));
    setAnalyzing(false);
    return next.sort((a, b) => scoreOf(b) - scoreOf(a));
  }

  async function search() {
    if (!props.job) {
      setErr("请先在投递设置中选择目标岗位。");
      return;
    }
    setErr("");
    setSearching(true);
    setBossJobs([]);
    props.onApplyStatus?.({ state: "idle", done: 0, total: 0 });
    try {
      const raw = await bossSearch(props.job, cityCode(props.city));
      const list: UnifiedJob[] = raw.filter((j) => salaryMatches(j.salary, props.salary)).map((j) => ({ ...j, source: "boss" }));
      setBossJobs(await scoreJobs(list));
      if (!raw.length) setErr("没抓到岗位卡片，请确认 BOSS 窗口已登录且停在搜索页。");
      else if (!list.length) setErr(`抓到 ${raw.length} 条，但都不在「${props.salary}」区间。可换薪资档位或选「不限」。`);
      else if (list.length < raw.length) setErr(`已按薪资「${props.salary}」过滤：${raw.length} → ${list.length} 条。`);
    } catch (e) {
      setErr(String(e));
    } finally {
      setSearching(false);
    }
  }

  async function ensureJd(j: UnifiedJob): Promise<string> {
    if (j.jd) return j.jd;
    const id = jobKey(j);
    setFetching(id);
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
    const key = jobKey(job);
    const map = (j: UnifiedJob) => (jobKey(j) === key ? { ...j, ...patch } : j);
    setBossJobs((xs) => xs.map(map));
    setInboxJobs((xs) => xs.map(map));
  }

  function modelName() {
    return props.contentTier === "deep" ? props.gateway.deep.model : props.gateway.light.model;
  }

  async function generatePack(j: UnifiedJob) {
    if (!props.root) {
      setErr("数据目录尚未就绪，桌面版才能生成到文件。");
      return;
    }
    const id = jobKey(j);
    setGeneratingId(id);
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

  function toggleExpand(j: UnifiedJob) {
    const id = jobKey(j);
    setExpanded((cur) => (cur === id ? "" : id));
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
      const ids = visibleJobs.map(jobKey);
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
          </div>
          <p className="mt-1 mb-0 text-[12px] leading-4 text-text-2">
            当前目标：<strong className="text-text">{props.job || "未设置"}</strong> · 城市：<strong className="text-text">{props.city || "不限"}</strong> · 薪资：<strong className="text-text">{props.salary || "不限"}</strong>
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="secondary" size="sm" loading={searching || analyzing} onClick={search} icon={<RefreshCw size={14} strokeWidth={1.75} />}>
            刷新岗位
          </Button>
          <button type="button" title="筛选" className="icon-btn ghost h-9 w-9"><SlidersHorizontal size={17} strokeWidth={1.75} /></button>
        </div>
      </header>

      <div className="px-[18px] py-3">
        <div className="flex flex-wrap items-center gap-2">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className={
                "h-[34px] rounded border px-3 text-[13px] font-medium " +
                (filter === tab.key
                  ? "border-[#6EE7C8] bg-accent-soft text-accent-strong"
                  : "border-border bg-surface text-text-2 hover:border-accent hover:text-accent-strong")
              }
            >
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
          <Button variant="primary" size="sm" loading={searching || analyzing} onClick={search} icon={<Download size={15} strokeWidth={1.75} />}>{searching ? "抓取中..." : analyzing ? "评分中..." : "抓取岗位"}</Button>
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
        {replies && (
          <div className="mt-2 text-[12px] leading-4 text-text-2">
            回复漏斗：累计已投 {appliedIds.size} · 已沟通会话 {replies.total} · 有新回复 {replies.withReply}
          </div>
        )}
      </div>

      <div className="overflow-x-auto px-[18px] pb-2">
        <table className="w-full min-w-[880px] border-separate border-spacing-0 overflow-hidden rounded border border-border text-left">
          <thead>
            <tr className="h-10 bg-[#F8FAFC] text-[12px] font-semibold leading-4 text-[#475569]">
              <th className="w-11 border-b border-border px-3"><input type="checkbox" checked={visibleJobs.length > 0 && visibleJobs.every((j) => selected.has(jobKey(j)))} onChange={toggleAllVisible} /></th>
              <th className="border-b border-border px-3">岗位信息</th>
              <th className="w-[150px] border-b border-border px-3">匹配评分</th>
              <th className="w-[110px] border-b border-border px-3">薪资</th>
              <th className="w-20 border-b border-border px-3">城市</th>
              <th className="w-24 border-b border-border px-3">状态</th>
              <th className="w-[190px] border-b border-border px-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {visibleJobs.length === 0 ? (
              <tr>
                <td colSpan={7} className="h-[220px] border-b border-border px-4 text-center">
                  <div className="mx-auto flex max-w-[360px] flex-col items-center justify-center gap-2 text-text-2">
                    <Search size={28} strokeWidth={1.75} className="text-muted" />
                    <div className="text-[14px] font-bold text-text">暂无候选岗位</div>
                    <div className="text-[12px] leading-5">完成目标设置后，可从 BOSS 抓取岗位并进行匹配评分。</div>
                    <Button size="sm" variant="primary" onClick={search} icon={<Download size={14} strokeWidth={1.75} />}>抓取岗位</Button>
                  </div>
                </td>
              </tr>
            ) : visibleJobs.map((j, index) => {
              const id = jobKey(j);
              const openRow = expanded === id;
              const level = matchLevel(j);
              const score = scoreOf(j);
              const tags = splitTags(j.tags);
              const salary = salaryParts(j.salary);
              const applied = appliedIds.has(j.id || j.href);
              const low = level === "low";
              const statusLabel = applied ? "已投递" : low ? "低于阈值" : "待投递";
              return (
                <Fragment key={id}>
                  <tr className="h-[78px] bg-surface text-[13px] leading-[18px] text-text hover:bg-[#FBFCFE]">
                    <td className="border-b border-border px-3"><input type="checkbox" checked={selected.has(id)} onChange={() => toggleSelected(id)} /></td>
                    <td className="border-b border-border px-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className={"flex h-10 w-10 shrink-0 items-center justify-center rounded text-[20px] font-bold text-white " + AVATAR_STYLES[index % AVATAR_STYLES.length]}>
                          {AVATAR_LETTERS[index % AVATAR_LETTERS.length]}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate font-bold text-text">{j.title || "(无标题)"}</div>
                          <div className="truncate text-[12px] text-text-2">{j.company || "未知公司"} · {tags.companySize}</div>
                          <div className="truncate text-[12px] text-text-2">{tags.experience} · {tags.education}{tags.extra ? ` · ${tags.extra}` : ""}</div>
                        </div>
                      </div>
                    </td>
                    <td className="border-b border-border px-3">
                      <div className="flex items-center gap-2">
                        <strong className="w-7 text-[14px] text-text">{score || "--"}</strong>
                        <span className="h-1 w-24 overflow-hidden rounded-full bg-[#E5E7EB]">
                          <i className="block h-full rounded-full bg-[#1D6FEA]" style={{ width: `${score}%` }} />
                        </span>
                      </div>
                      <div className={"mt-1 text-[12px] font-medium " + (level === "high" ? "text-accent-strong" : level === "medium" ? "text-[#1D6FEA]" : "text-text-2")}>{matchLabel(level)}</div>
                    </td>
                    <td className="border-b border-border px-3">
                      <div className="font-medium text-text">{salary.main}</div>
                      <div className="text-[12px] text-text-2">{salary.months || ""}</div>
                    </td>
                    <td className="border-b border-border px-3">{props.city || "不限"}</td>
                    <td className="border-b border-border px-3">
                      <span className={"inline-flex rounded-full px-2 py-1 text-[12px] font-medium " + (applied ? "bg-surface-2 text-text-2" : low ? "bg-ai-soft text-text-2" : "bg-[#FFF7ED] text-warn")}>{statusLabel}</span>
                      {low && <div className="mt-1 text-[12px] text-text-2">&lt; 70 分</div>}
                    </td>
                    <td className="border-b border-border px-3">
                      <div className="flex items-center gap-2">
                        {low || applied ? (
                          <Button size="sm" variant="secondary" onClick={() => toggleExpand(j)}>详情</Button>
                        ) : (
                          <Button size="sm" variant="primary" onClick={() => setApplyJob(j)} icon={<Send size={14} strokeWidth={1.75} />}>投递</Button>
                        )}
                        <button type="button" className="icon-btn ghost h-8 w-8" title="展开 JD" onClick={() => toggleExpand(j)}><ChevronDown size={15} strokeWidth={1.75} /></button>
                        {j.href && <a className="inline-flex h-8 w-8 items-center justify-center rounded border border-border bg-surface text-text-2 no-underline hover:border-accent hover:text-accent-strong" href={j.href} target="_blank" rel="noreferrer" title="打开原岗位"><ExternalLink size={14} strokeWidth={1.75} /></a>}
                        <button type="button" className="icon-btn ghost h-8 w-8" title="更多"><MoreHorizontal size={16} strokeWidth={1.75} /></button>
                      </div>
                    </td>
                  </tr>
                  {openRow && (
                    <tr className="bg-[#FBFCFE]">
                      <td className="border-b border-border" />
                      <td colSpan={6} className="border-b border-border px-3 py-3">
                        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
                          <div>
                            <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold text-text-2">
                              <FileText size={14} strokeWidth={1.75} /> 岗位 JD / AI 理由
                            </div>
                            {j.reason && <div className="mb-2 rounded border border-border bg-surface px-3 py-2 text-[12px] text-text-2">AI 理由：{j.reason}</div>}
                            <textarea rows={4} value={j.jd || ""} placeholder="点击 JD 按钮抓取，或由扩展推送自动带入。" onChange={(e) => { patchJob(j, { jd: e.target.value }); props.onPickJd(e.target.value); }} />
                          </div>
                          <div className="flex min-w-[160px] flex-col gap-2">
                            <Button variant="secondary" size="sm" disabled={!!fetching} onClick={() => ensureJd(j).then((jd) => props.onPickJd(jd)).catch((e) => setErr(String(e)))} icon={<FileText size={14} strokeWidth={1.75} />}>{fetching === id ? "抓取中..." : "抓取 JD"}</Button>
                            <Button size="sm" loading={generatingId === id} onClick={() => generatePack(j)} icon={<Sparkles size={14} strokeWidth={1.75} />}>生成内容包</Button>
                            <Button variant="secondary" size="sm" onClick={() => setApplyJob(j)} icon={<Send size={14} strokeWidth={1.75} />}>{applied ? "再次投递" : "投递"}</Button>
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
        <label className="inline-flex items-center gap-2"><input type="checkbox" checked={visibleJobs.length > 0 && visibleJobs.every((j) => selected.has(jobKey(j)))} onChange={toggleAllVisible} /> 已选择 {selected.size} 个岗位</label>
        <span className="flex-1" />
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((p) => (
            <button key={p} type="button" className={"h-8 w-8 rounded border p-0 text-[12px] " + (p === 1 ? "border-accent bg-accent text-white" : "border-border bg-surface text-text-2")}>{p}</button>
          ))}
          <span className="px-2">...</span>
          <button type="button" className="h-8 w-8 rounded border border-border bg-surface p-0 text-[12px] text-text-2">22</button>
        </div>
        <select className="h-8 w-[92px] py-1 text-[12px]" value="10" onChange={() => undefined}>
          <option value="10">10 条/页</option>
        </select>
      </footer>

      {applyJob && <ApplyModal gateway={props.gateway} jobLabel={props.job} city={props.city} bossJob={applyJob} resume={props.resume} instruction={props.instruction} root={props.root} dailyCap={safety.dailyCap} onClose={() => setApplyJob(null)} onApplied={handleApplied} />}
      {showBatch && <BatchApplyModal gateway={props.gateway} jobs={allJobs} jobLabel={props.job} city={props.city} resume={props.resume} instruction={props.instruction} dailyCap={safety.dailyCap} delayMin={safety.delayMin} delayMax={safety.delayMax} onClose={() => setShowBatch(false)} onApplied={handleApplied} />}
    </section>
  );
}

