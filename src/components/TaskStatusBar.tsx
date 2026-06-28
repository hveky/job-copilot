import { BriefcaseBusiness, Cpu, FileText, Gauge, Loader2 } from "lucide-react";
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

function stateLabel(state: ContentTaskState) {
  switch (state) {
    case "fetching":
      return "抓取 JD";
    case "thinking":
      return "模型推理中";
    case "generating":
      return "内容包生成中";
    case "done":
      return "内容包已生成";
    case "error":
      return "内容包失败";
    default:
      return "内容包空闲";
  }
}

export function TaskStatusBar(props: {
  todayApplied: number;
  dailyCap: number;
  candidates: number;
  content: ContentTaskStatus;
  apply: ApplyTaskStatus;
}) {
  const contentBusy = props.content.state === "fetching" || props.content.state === "thinking" || props.content.state === "generating";
  const applyBusy = props.apply.state === "running" || props.apply.state === "waiting";
  return (
    <footer className="z-30 flex h-11 shrink-0 items-center gap-3 border-t border-border bg-surface px-4 text-aux text-text-2 shadow-[0_-1px_8px_rgba(15,23,42,0.04)]">
      <div className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1">
        <Gauge size={14} strokeWidth={1.75} className="text-accent-strong" />
        今日投递 <strong className="text-text">{props.todayApplied}/{props.dailyCap}</strong>
      </div>
      <div className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1">
        <BriefcaseBusiness size={14} strokeWidth={1.75} className="text-accent-strong" />
        候选岗位 <strong className="text-text">{props.candidates}</strong>
      </div>
      <div className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-ai-soft px-3 py-1 text-ai">
        <Cpu size={14} strokeWidth={1.75} />
        <span className="shrink-0">内容模型</span>
        <strong className="truncate text-ai">{props.content.tier === "deep" ? "深度" : "轻活"} · {props.content.model}</strong>
      </div>
      <div className="inline-flex min-w-0 flex-1 items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1">
        {contentBusy ? <Loader2 size={14} className="spin text-accent-strong" /> : <FileText size={14} strokeWidth={1.75} className="text-accent-strong" />}
        <span className="shrink-0">{stateLabel(props.content.state)}</span>
        {(props.content.path || props.content.message) && (
          <span className="truncate text-muted">{props.content.path || props.content.message}</span>
        )}
      </div>
      <div className="hidden items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 md:inline-flex">
        {applyBusy && <Loader2 size={14} className="spin text-accent-strong" />}
        投递进度 <strong className="text-text">{props.apply.done}/{props.apply.total}</strong>
        {props.apply.message && <span className="text-muted">· {props.apply.message}</span>}
      </div>
    </footer>
  );
}
