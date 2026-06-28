import { useState } from "react";
import { CheckCircle, ChevronDown, LoaderCircle } from "lucide-react";
import type { Tier } from "../gateway/types";

export type ContentTaskState = "idle" | "fetching" | "thinking" | "generating" | "done" | "error";
export type ApplyTaskState = "idle" | "running" | "waiting" | "done" | "error";

export interface ContentTaskStatus {
  state: ContentTaskState;
  tier: Tier;
  model: string;
  path?: string;
  message?: string;
}

export interface ApplyTaskStatus {
  state: ApplyTaskState;
  done: number;
  total: number;
  message?: string;
}

function formatEta(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

function progressPct(done: number, total: number) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((done / total) * 100)));
}

export function TaskStatusBar(props: {
  todayApplied: number;
  dailyCap: number;
  candidates: number;
  content: ContentTaskStatus;
  apply: ApplyTaskStatus;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const contentBusy = props.content.state === "fetching" || props.content.state === "thinking" || props.content.state === "generating";
  const applyBusy = props.apply.state === "running" || props.apply.state === "waiting";
  const fetchTarget = Math.max(150, props.candidates || 0);
  const scoreTotal = props.candidates;
  const scoreDone = contentBusy ? 0 : props.candidates > 0 ? props.candidates : 0;
  const eta = applyBusy
    ? Math.max(0, (props.apply.total - props.apply.done) * 60)
    : props.candidates < 150
      ? Math.max(0, (150 - props.candidates) * 4)
      : 0;

  if (collapsed) {
    return (
      <footer className="z-30 flex h-9 shrink-0 items-center gap-4 border-t border-border bg-surface px-6 text-[12px] text-text-2 shadow-[0_-1px_0_rgba(15,23,42,0.08)]">
        <span>当前进度</span>
        <strong className="text-accent-strong">抓取岗位 {props.candidates}/{fetchTarget}</strong>
        <span>安全投递 {props.todayApplied}/{props.dailyCap}</span>
        <span className="flex-1" />
        <button type="button" className="ghost small h-7 px-2" onClick={() => setCollapsed(false)}>展开</button>
      </footer>
    );
  }

  return (
    <footer className="z-30 flex h-24 shrink-0 items-center gap-4 overflow-x-auto border-t border-border bg-surface px-7 py-4 text-text shadow-[0_-1px_0_rgba(15,23,42,0.08)]">
      <div className="hidden w-16 text-[12px] leading-4 text-text-2 xl:block">当前进度</div>
      <TaskCard index={1} title="设定目标" state="done" status="已完成" compact />
      <TaskCard
        index={2}
        title="抓取岗位"
        state={props.candidates >= fetchTarget ? "done" : "active"}
        status={props.candidates >= fetchTarget ? "已完成" : "进行中"}
        done={props.candidates}
        total={fetchTarget}
        wide
      />
      <TaskCard
        index={3}
        title="匹配评分"
        state={scoreTotal > 0 && scoreDone >= scoreTotal ? "done" : "pending"}
        status={scoreTotal > 0 && scoreDone >= scoreTotal ? "已完成" : "等待中"}
        done={scoreDone}
        total={scoreTotal}
        wide
      />
      <TaskCard
        index={4}
        title="安全投递"
        state={applyBusy ? "active" : props.todayApplied > 0 ? "done" : "pending"}
        status={applyBusy ? "进行中" : props.todayApplied > 0 ? "已记录" : "等待中"}
        done={props.todayApplied}
        total={props.dailyCap}
        compact
      />
      <div className="ml-auto hidden min-w-[120px] text-center 2xl:block">
        <div className="text-[12px] leading-4 text-text-2">预计剩余时间</div>
        <div className="mt-1 font-mono text-[18px] leading-6 text-text">{formatEta(eta)}</div>
      </div>
      <button type="button" className="ghost inline-flex h-9 items-center gap-1 px-3" onClick={() => setCollapsed(true)}>
        收起
        <ChevronDown size={15} strokeWidth={1.75} />
      </button>
    </footer>
  );
}

function TaskCard(props: {
  index: number;
  title: string;
  state: "done" | "active" | "pending";
  status: string;
  done?: number;
  total?: number;
  compact?: boolean;
  wide?: boolean;
}) {
  const pct = progressPct(props.done ?? 0, props.total ?? 0);
  return (
    <div
      className={
        "flex h-[68px] shrink-0 items-center gap-3 rounded-lg border px-4 " +
        (props.wide ? "w-[min(26vw,450px)] min-w-[260px]" : props.compact ? "w-[min(15vw,220px)] min-w-[170px]" : "w-[220px]") +
        " " +
        (props.state === "active" ? "border-[#BFDBFE] bg-white" : "border-border bg-white")
      }
    >
      <span
        className={
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold " +
          (props.state === "done"
            ? "bg-accent text-white"
            : props.state === "active"
              ? "bg-[#1D6FEA] text-white"
              : "bg-[#E5E7EB] text-text")
        }
      >
        {props.index}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="truncate text-[14px] font-bold leading-5 text-text">{props.title}</div>
          {props.state === "done" && <CheckCircle size={16} strokeWidth={1.85} className="ml-auto text-accent-strong" />}
          {props.state === "active" && <LoaderCircle size={15} strokeWidth={1.75} className="ml-auto spin text-[#1D6FEA]" />}
        </div>
        <div className="mt-1 flex items-center gap-2 text-[12px] leading-4 text-text-2">
          <span className={props.state === "active" ? "text-[#1D6FEA]" : props.state === "done" ? "text-accent-strong" : ""}>{props.status}</span>
          {typeof props.done === "number" && typeof props.total === "number" && props.total > 0 && (
            <>
              <span className="h-[6px] min-w-[80px] flex-1 overflow-hidden rounded-full bg-[#E5E7EB]">
                <i className={(props.state === "done" ? "bg-accent" : "bg-[#1D6FEA]") + " block h-full rounded-full"} style={{ width: `${pct}%` }} />
              </span>
              <span className="whitespace-nowrap">{props.done} / {props.total}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

