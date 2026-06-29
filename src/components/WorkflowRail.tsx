import { CheckCircle2, Circle, ArrowRight } from "lucide-react";

export type WorkflowStep = "filter" | "fetch" | "generate" | "reply";

const STEPS: { key: WorkflowStep; label: string }[] = [
  { key: "filter", label: "筛选岗位" },
  { key: "fetch", label: "抓取岗位" },
  { key: "generate", label: "生成内容" },
  { key: "reply", label: "沟通回复" },
];

/** 横向步骤导航：当前步骤高亮，已完成显示对勾。 */
export function WorkflowRail({ current }: { current: WorkflowStep }) {
  const currentIdx = STEPS.findIndex((s) => s.key === current);
  return (
    <div className="mb-4 flex items-center gap-1 overflow-x-auto rounded bg-surface border border-border shadow-card px-4 py-3">
      {STEPS.map((s, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <div key={s.key} className="flex items-center gap-1">
            <div
              className={
                "flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors " +
                (active
                  ? "bg-accent-soft text-accent-strong"
                  : done
                    ? "text-accent-strong"
                    : "text-muted")
              }
            >
              {done ? (
                <CheckCircle2 size={18} strokeWidth={1.75} />
              ) : (
                <Circle
                  size={18}
                  strokeWidth={active ? 2.25 : 1.75}
                  className={active ? "text-accent" : ""}
                />
              )}
              <span className="whitespace-nowrap">{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <ArrowRight
                size={16}
                strokeWidth={1.75}
                className="text-muted/60 mx-0.5"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
